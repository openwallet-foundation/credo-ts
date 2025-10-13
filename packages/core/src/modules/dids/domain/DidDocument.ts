import { Expose, Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { CredoError } from '../../../error'
import { TypedArrayEncoder } from '../../../utils'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { IsStringOrStringArray } from '../../../utils/transformers'
import { Ed25519PublicJwk, PublicJwk, X25519PublicJwk } from '../../kms'
import { findMatchingEd25519Key } from '../findMatchingEd25519Key'
import { getPublicJwkFromVerificationMethod } from './key-type'
import type { DidDocumentService } from './service'
import { DidCommV1Service, IndyAgentService } from './service'
import { ServiceTransformer } from './service/ServiceTransformer'
import { IsStringOrVerificationMethod, VerificationMethod, VerificationMethodTransformer } from './verificationMethod'

export type DidPurpose =
  | 'authentication'
  | 'keyAgreement'
  | 'assertionMethod'
  | 'capabilityInvocation'
  | 'capabilityDelegation'

type DidVerificationMethods = DidPurpose | 'verificationMethod'

interface DidDocumentOptions {
  context?: string | string[]
  id: string
  alsoKnownAs?: string[]
  controller?: string | string[]
  verificationMethod?: VerificationMethod[]
  service?: DidDocumentService[]
  authentication?: Array<string | VerificationMethod>
  assertionMethod?: Array<string | VerificationMethod>
  keyAgreement?: Array<string | VerificationMethod>
  capabilityInvocation?: Array<string | VerificationMethod>
  capabilityDelegation?: Array<string | VerificationMethod>
}

export class DidDocument {
  @Expose({ name: '@context' })
  @IsStringOrStringArray()
  public context: string | string[] = ['https://www.w3.org/ns/did/v1']

  @IsString()
  public id!: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public alsoKnownAs?: string[]

  @IsStringOrStringArray()
  @IsOptional()
  public controller?: string | string[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationMethod)
  @IsOptional()
  public verificationMethod?: VerificationMethod[]

  @IsArray()
  @ServiceTransformer()
  @IsOptional()
  public service?: DidDocumentService[]

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  @IsOptional()
  public authentication?: Array<string | VerificationMethod>

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  @IsOptional()
  public assertionMethod?: Array<string | VerificationMethod>

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  @IsOptional()
  public keyAgreement?: Array<string | VerificationMethod>

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  @IsOptional()
  public capabilityInvocation?: Array<string | VerificationMethod>

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  @IsOptional()
  public capabilityDelegation?: Array<string | VerificationMethod>

  public constructor(options: DidDocumentOptions) {
    if (options) {
      this.context = options.context ?? this.context
      this.id = options.id
      this.alsoKnownAs = options.alsoKnownAs
      this.controller = options.controller
      this.verificationMethod = options.verificationMethod
      this.service = options.service
      this.authentication = options.authentication
      this.assertionMethod = options.assertionMethod
      this.keyAgreement = options.keyAgreement
      this.capabilityInvocation = options.capabilityInvocation
      this.capabilityDelegation = options.capabilityDelegation
    }
  }

  public dereferenceVerificationMethod(keyId: string) {
    // TODO: once we use JSON-LD we should use that to resolve references in did documents.
    // for now we check whether the key id ends with the keyId.
    // so if looking for #123 and key.id is did:key:123#123, it is valid. But #123 as key.id is also valid
    const verificationMethod = this.verificationMethod?.find((key) => key.id.endsWith(keyId))

    if (!verificationMethod) {
      throw new CredoError(`Unable to locate verification method with id '${keyId}'`)
    }

    return verificationMethod
  }

  public dereferenceKey(keyId: string, allowedPurposes?: DidVerificationMethods[]) {
    const allPurposes: DidVerificationMethods[] = [
      'authentication',
      'keyAgreement',
      'assertionMethod',
      'capabilityInvocation',
      'capabilityDelegation',
      'verificationMethod',
    ]

    const purposes = allowedPurposes ?? allPurposes

    for (const purpose of purposes) {
      for (const key of this[purpose] ?? []) {
        if (typeof key === 'string' && key.endsWith(keyId)) {
          return this.dereferenceVerificationMethod(key)
        }
        if (typeof key !== 'string' && key.id.endsWith(keyId)) {
          return key
        }
      }
    }

    throw new CredoError(`Unable to locate verification method with id '${keyId}' in purposes ${purposes}`)
  }

  public findVerificationMethodByPublicKey(publicJwk: PublicJwk, allowedPurposes?: DidVerificationMethods[]) {
    const allPurposes: DidVerificationMethods[] = [
      'authentication',
      'keyAgreement',
      'assertionMethod',
      'capabilityInvocation',
      'capabilityDelegation',
      'verificationMethod',
    ]

    const purposes = allowedPurposes ?? allPurposes

    for (const purpose of purposes) {
      for (const key of this[purpose] ?? []) {
        const verificationMethod = typeof key === 'string' ? this.dereferenceVerificationMethod(key) : key
        if (getPublicJwkFromVerificationMethod(verificationMethod).equals(publicJwk)) return verificationMethod
      }
    }

    throw new CredoError(
      `Unable to locate verification method with public key ${publicJwk.jwkTypehumanDescription} in purposes ${purposes}`
    )
  }

  /**
   * Returns all of the service endpoints matching the given type.
   *
   * @param type The type of service(s) to query.
   */
  public getServicesByType<S extends DidDocumentService = DidDocumentService>(type: string): S[] {
    return (this.service?.filter((service) => service.type === type) ?? []) as S[]
  }

  /**
   * Returns all of the service endpoints matching the given class
   *
   * @param classType The class to query services.
   */
  public getServicesByClassType<S extends DidDocumentService = DidDocumentService>(
    classType: new (...args: never[]) => S
  ): S[] {
    return (this.service?.filter((service) => service instanceof classType) ?? []) as S[]
  }

  /**
   * Get all DIDComm services ordered by priority descending. This means the highest
   * priority will be the first entry.
   */
  public get didCommServices(): Array<IndyAgentService | DidCommV1Service> {
    const didCommServiceTypes = [IndyAgentService.type, DidCommV1Service.type]
    const services = (this.service?.filter((service) => didCommServiceTypes.includes(service.type)) ?? []) as Array<
      IndyAgentService | DidCommV1Service
    >

    // Sort services based on indicated priority
    return services.sort((a, b) => a.priority - b.priority)
  }

  // TODO: it would probably be easier if we add a utility to each service so we don't have to handle logic for all service types here
  public get recipientKeys(): PublicJwk<Ed25519PublicJwk | X25519PublicJwk>[] {
    return this.getRecipientKeysWithVerificationMethod({
      // False for now to avoid breaking changes
      mapX25519ToEd25519: false,
    }).map(({ publicJwk }) => publicJwk)
  }

  /**
   * Returns the recipient keys with their verification method matches
   *
   * We should probably deprecate recipientKeys in favour of this one
   */
  public getRecipientKeysWithVerificationMethod<MapX25519ToEd25519 extends boolean>({
    mapX25519ToEd25519,
  }: {
    mapX25519ToEd25519: MapX25519ToEd25519
  }): Array<{
    verificationMethod: VerificationMethod
    publicJwk: PublicJwk<MapX25519ToEd25519 extends true ? Ed25519PublicJwk : Ed25519PublicJwk | X25519PublicJwk>
  }> {
    const recipientKeys: Array<{
      verificationMethod: VerificationMethod
      publicJwk: PublicJwk<Ed25519PublicJwk | X25519PublicJwk>
    }> = []

    const seenVerificationMethodIds: string[] = []
    for (const service of this.didCommServices) {
      if (service.type === IndyAgentService.type) {
        for (const publicKeyBase58 of service.recipientKeys) {
          const publicJwk = PublicJwk.fromPublicKey({
            kty: 'OKP',
            crv: 'Ed25519',
            publicKey: TypedArrayEncoder.fromBase58(publicKeyBase58),
          })
          const verificationMethod = [...(this.verificationMethod ?? []), ...(this.authentication ?? [])]
            .map((v) => (typeof v === 'string' ? this.dereferenceVerificationMethod(v) : v))
            .find((v) => {
              const vPublicJwk = getPublicJwkFromVerificationMethod(v)
              return vPublicJwk.equals(publicJwk)
            })

          if (!verificationMethod) {
            throw new CredoError('Could not find verification method for IndyAgentService recipient key')
          }

          // Skip adding if already present
          if (seenVerificationMethodIds.includes(verificationMethod.id)) {
            continue
          }

          recipientKeys.push({
            publicJwk,
            verificationMethod,
          })
        }
      } else if (service.type === DidCommV1Service.type) {
        for (const recipientKey of service.recipientKeys) {
          const verificationMethod = this.dereferenceKey(recipientKey, ['authentication', 'keyAgreement'])
          if (seenVerificationMethodIds.includes(verificationMethod.id)) {
            // Skip adding if already present
            continue
          }

          const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

          if (!publicJwk.is(Ed25519PublicJwk, X25519PublicJwk)) {
            throw new CredoError(
              'Expected either Ed25519PublicJwk or X25519PublicJwk for DidcommV1Service recipient key'
            )
          }

          recipientKeys.push({
            publicJwk,
            verificationMethod,
          })
        }
      }
    }

    if (!mapX25519ToEd25519) {
      return recipientKeys as Array<{
        verificationMethod: VerificationMethod
        publicJwk: PublicJwk<MapX25519ToEd25519 extends true ? Ed25519PublicJwk : Ed25519PublicJwk | X25519PublicJwk>
      }>
    }

    return recipientKeys.map(({ publicJwk, verificationMethod }) => {
      if (publicJwk.is(Ed25519PublicJwk)) return { publicJwk, verificationMethod }

      const matchingEd25519Key = findMatchingEd25519Key(publicJwk as PublicJwk<X25519PublicJwk>, this)

      // For DIDcomm v1 if you use X25519 you MUST also include the Ed25519 key
      if (!matchingEd25519Key) {
        throw new CredoError(
          `Unable to find matching Ed25519 key for X25519 verification method with id ${verificationMethod.id}`
        )
      }

      return matchingEd25519Key
    })
  }

  public toJSON() {
    return JsonTransformer.toJSON(this)
  }

  public static fromJSON(didDocument: unknown) {
    return JsonTransformer.fromJSON(didDocument, DidDocument)
  }
}

/**
 * Extracting the verification method for signature type
 * @param type Signature type
 * @param didDocument DidDocument
 * @returns verification method
 */
export async function findVerificationMethodByKeyType(
  keyType: string,
  didDocument: DidDocument
): Promise<VerificationMethod | null> {
  const didVerificationMethods: DidVerificationMethods[] = [
    'verificationMethod',
    'authentication',
    'keyAgreement',
    'assertionMethod',
    'capabilityInvocation',
    'capabilityDelegation',
  ]
  for (const purpose of didVerificationMethods) {
    const key: VerificationMethod[] | (string | VerificationMethod)[] | undefined = didDocument[purpose]
    if (Array.isArray(key)) {
      for (const method of key) {
        if (typeof method !== 'string') {
          if (method.type === keyType) {
            return method
          }
        }
      }
    }
  }

  return null
}
