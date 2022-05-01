import type { Key } from './Key'
import type { DidDocumentService } from './service'

import { Expose, Transform, Type } from 'class-transformer'
import { IsArray, IsString, ValidateNested } from 'class-validator'

import { JsonTransformer } from '../../../utils/JsonTransformer'
import { keyReferenceToKey, verkeyToInstanceOfKey } from '../helpers'

import { IndyAgentService, ServiceTransformer, DidCommV1Service } from './service'
import { VerificationMethodTransformer, VerificationMethod, IsStringOrVerificationMethod } from './verificationMethod'

type DidPurpose =
  | 'authentication'
  | 'keyAgreement'
  | 'assertionMethod'
  | 'capabilityInvocation'
  | 'capabilityDelegation'

interface DidDocumentOptions {
  context?: string[]
  id: string
  alsoKnownAs?: string[]
  controller?: string[]
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
  @IsArray()
  @Transform((o) => (typeof o.value === 'string' ? [o.value] : o.value), { toClassOnly: true })
  public context = ['https://w3id.org/did/v1']

  @IsString()
  public id!: string

  @IsArray()
  @IsString({ each: true })
  public alsoKnownAs: string[] = []

  @IsArray()
  @IsString({ each: true })
  @Transform((o) => (typeof o.value === 'string' ? [o.value] : o.value), { toClassOnly: true })
  public controller: string[] = []

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationMethod)
  public verificationMethod: VerificationMethod[] = []

  @IsArray()
  @ServiceTransformer()
  public service: DidDocumentService[] = []

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  public authentication: Array<string | VerificationMethod> = []

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  public assertionMethod: Array<string | VerificationMethod> = []

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  public keyAgreement: Array<string | VerificationMethod> = []

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  public capabilityInvocation: Array<string | VerificationMethod> = []

  @IsArray()
  @VerificationMethodTransformer()
  @IsStringOrVerificationMethod({ each: true })
  public capabilityDelegation: Array<string | VerificationMethod> = []

  public constructor(options: DidDocumentOptions) {
    if (options) {
      this.context = options.context ?? this.context
      this.id = options.id
      this.alsoKnownAs = options.alsoKnownAs ?? this.alsoKnownAs
      this.controller = options.controller ?? this.controller
      this.verificationMethod = options.verificationMethod ?? this.verificationMethod
      this.service = options.service ?? this.service
      this.authentication = options.authentication ?? this.authentication
      this.assertionMethod = options.assertionMethod ?? this.assertionMethod
      this.keyAgreement = options.keyAgreement ?? this.keyAgreement
      this.capabilityInvocation = options.capabilityInvocation ?? this.capabilityInvocation
      this.capabilityDelegation = options.capabilityDelegation ?? this.capabilityDelegation
    }
  }

  public dereferenceVerificationMethod(keyId: string) {
    // TODO: once we use JSON-LD we should use that to resolve references in did documents.
    // for now we check whether the key id ends with the keyId.
    // so if looking for #123 and key.id is did:key:123#123, it is valid. But #123 as key.id is also valid
    const verificationMethod = this.verificationMethod.find((key) => key.id.endsWith(keyId))

    if (!verificationMethod) {
      throw new Error(`Unable to locate verification method with id '${keyId}'`)
    }

    return verificationMethod
  }

  public dereferenceKey(keyId: string, allowedPurposes?: DidPurpose[]) {
    const allPurposes: DidPurpose[] = [
      'authentication',
      'keyAgreement',
      'assertionMethod',
      'capabilityInvocation',
      'capabilityDelegation',
    ]

    const purposes = allowedPurposes ?? allPurposes

    for (const purpose of purposes) {
      for (const key of this[purpose]) {
        if (typeof key === 'string' && key.endsWith(keyId)) {
          return this.dereferenceVerificationMethod(key)
        } else if (typeof key !== 'string' && key.id.endsWith(keyId)) {
          return key
        }
      }
    }

    throw new Error(`Unable to locate verification method with id '${keyId}' in purposes ${purposes}`)
  }

  /**
   * Returns all of the service endpoints matching the given type.
   *
   * @param type The type of service(s) to query.
   */
  public getServicesByType<S extends DidDocumentService = DidDocumentService>(type: string): S[] {
    return this.service.filter((service) => service.type === type) as S[]
  }

  /**
   * Returns all of the service endpoints matching the given class
   *
   * @param classType The class to query services.
   */
  public getServicesByClassType<S extends DidDocumentService = DidDocumentService>(
    classType: new (...args: never[]) => S
  ): S[] {
    return this.service.filter((service) => service instanceof classType) as S[]
  }

  /**
   * Get all DIDComm services ordered by priority descending. This means the highest
   * priority will be the first entry.
   */
  public get didCommServices(): Array<IndyAgentService | DidCommV1Service> {
    const didCommServiceTypes = [IndyAgentService.type, DidCommV1Service.type]
    const services = this.service.filter((service) => didCommServiceTypes.includes(service.type)) as Array<
      IndyAgentService | DidCommV1Service
    >

    // Sort services based on indicated priority
    return services.sort((a, b) => b.priority - a.priority)
  }

  // TODO: it would probably be easier if we add a utility to each service so we don't have to handle logic for all service types here
  public get recipientKeys(): Key[] {
    let recipientKeys: Key[] = []

    for (const service of this.didCommServices) {
      if (service instanceof IndyAgentService) {
        recipientKeys = [...recipientKeys, ...service.recipientKeys.map(verkeyToInstanceOfKey)]
      } else if (service instanceof DidCommV1Service) {
        recipientKeys = [
          ...recipientKeys,
          ...service.recipientKeys.map((recipientKey) => keyReferenceToKey(this, recipientKey)),
        ]
      }
    }

    return recipientKeys
  }

  public toJSON() {
    return JsonTransformer.toJSON(this)
  }
}
