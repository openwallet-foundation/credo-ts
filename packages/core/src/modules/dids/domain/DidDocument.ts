import type { DidDocumentService } from './service'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'

import { JsonTransformer } from '../../../utils/JsonTransformer'
import { IsStringOrStringArray } from '../../../utils/transformers'

import { IndyAgentService, ServiceTransformer, DidCommService } from './service'
import { VerificationMethodTransformer, VerificationMethod, IsStringOrVerificationMethod } from './verificationMethod'

interface DidDocumentOptions {
  context?: string | string[]
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
  @IsStringOrStringArray()
  public context: string | string[] = ['https://w3id.org/did/v1']

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

  public dereferenceKey(keyId: string) {
    // TODO: once we use JSON-LD we should use that to resolve references in did documents.
    // for now we check whether the key id ends with the keyId.
    // so if looking for #123 and key.id is did:key:123#123, it is valid. But #123 as key.id is also valid
    const verificationMethod = this.verificationMethod?.find((key) => key.id.endsWith(keyId))

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
  public get didCommServices(): Array<IndyAgentService | DidCommService> {
    const didCommServiceTypes = [IndyAgentService.type, DidCommService.type]
    const services = (this.service?.filter((service) => didCommServiceTypes.includes(service.type)) ?? []) as Array<
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

  public toJSON() {
    return JsonTransformer.toJSON(this)
  }
}
