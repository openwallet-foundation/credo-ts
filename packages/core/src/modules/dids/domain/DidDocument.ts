import type { DidDocumentService } from './service'

import { Expose, Transform, Type } from 'class-transformer'
import { IsArray, IsString, ValidateNested } from 'class-validator'

import { TypedArrayEncoder } from '../../../utils'
import { JsonTransformer } from '../../../utils/JsonTransformer'

import { IndyAgentService, ServiceTransformer, DidCommService } from './service'
import { VerificationMethodTransformer, VerificationMethod, IsStringOrVerificationMethod } from './verificationMethod'

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

  public dereferenceKey(keyId: string) {
    // TODO: once we use JSON-LD we should use that to resolve references in did documents.
    // for now we check whether the key id ends with the keyId.
    // so if looking for #123 and key.id is did:key:123#123, it is valid. But #123 as key.id is also valid
    const verificationMethod = this.verificationMethod.find((key) => key.id.endsWith(keyId))

    if (!verificationMethod) {
      throw new Error(`Unable to locate verification with id '${keyId}'`)
    }

    return verificationMethod
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
  public get didCommServices(): Array<IndyAgentService | DidCommService> {
    const didCommServiceTypes = [IndyAgentService.type, DidCommService.type]
    const services = this.service.filter((service) => didCommServiceTypes.includes(service.type)) as Array<
      IndyAgentService | DidCommService
    >

    // Sort services based on indicated priority
    return services.sort((a, b) => b.priority - a.priority)
  }

  public get recipientKeys(): string[] {
    // Get a `recipientKeys` entries from the did document
    return this.didCommServices.reduce<string[]>(
      (recipientKeys, service) => recipientKeys.concat(service.recipientKeys),
      []
    )
  }

  public get verificationKey(): string {
    // get first available verification key
    return TypedArrayEncoder.toBase58(this.verificationMethod[0].keyBytes)
  }

  public toJSON() {
    return JsonTransformer.toJSON(this)
  }
}
