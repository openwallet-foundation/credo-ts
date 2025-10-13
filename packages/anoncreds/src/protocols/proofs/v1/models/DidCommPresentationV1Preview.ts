import { JsonTransformer } from '@credo-ts/core'
import { IsValidMessageType, parseMessageType, replaceLegacyDidSovPrefix } from '@credo-ts/didcomm'
import { Expose, Transform, Type } from 'class-transformer'
import {
  IsIn,
  IsInstance,
  IsInt,
  IsMimeType,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

import { type AnonCredsPredicateType, anonCredsPredicateType } from '../../../../models'
import { unqualifiedCredentialDefinitionIdRegex } from '../../../../utils'

export interface DidCommPresentationV1PreviewAttributeOptions {
  name: string
  credentialDefinitionId?: string
  mimeType?: string
  value?: string
  referent?: string
}

export class DidCommPresentationV1PreviewAttribute {
  public constructor(options: DidCommPresentationV1PreviewAttributeOptions) {
    if (options) {
      this.name = options.name
      this.credentialDefinitionId = options.credentialDefinitionId
      this.mimeType = options.mimeType
      this.value = options.value
      this.referent = options.referent
    }
  }

  public name!: string

  @Expose({ name: 'cred_def_id' })
  @IsString()
  @ValidateIf((o: DidCommPresentationV1PreviewAttribute) => o.referent !== undefined)
  @Matches(unqualifiedCredentialDefinitionIdRegex)
  public credentialDefinitionId?: string

  @Expose({ name: 'mime-type' })
  @IsOptional()
  @IsMimeType()
  public mimeType?: string

  @IsString()
  @IsOptional()
  public value?: string

  @IsString()
  @IsOptional()
  public referent?: string

  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }
}

export interface DidCommPresentationV1PreviewPredicateOptions {
  name: string
  credentialDefinitionId: string
  predicate: AnonCredsPredicateType
  threshold: number
}

export class DidCommPresentationV1PreviewPredicate {
  public constructor(options: DidCommPresentationV1PreviewPredicateOptions) {
    if (options) {
      this.name = options.name
      this.credentialDefinitionId = options.credentialDefinitionId
      this.predicate = options.predicate
      this.threshold = options.threshold
    }
  }

  @IsString()
  public name!: string

  @Expose({ name: 'cred_def_id' })
  @IsString()
  @Matches(unqualifiedCredentialDefinitionIdRegex)
  public credentialDefinitionId!: string

  @IsIn(anonCredsPredicateType)
  public predicate!: AnonCredsPredicateType

  @IsInt()
  public threshold!: number

  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }
}

export interface V1PresentationPreviewOptions {
  attributes?: DidCommPresentationV1PreviewAttributeOptions[]
  predicates?: DidCommPresentationV1PreviewPredicateOptions[]
}

/**
 * Presentation preview inner message class.
 *
 * This is not a message but an inner object for other messages in this protocol. It is used to construct a preview of the data for the presentation.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#presentation-preview
 */
export class DidCommPresentationV1Preview {
  public constructor(options: V1PresentationPreviewOptions) {
    if (options) {
      this.attributes = options.attributes?.map((a) => new DidCommPresentationV1PreviewAttribute(a)) ?? []
      this.predicates = options.predicates?.map((p) => new DidCommPresentationV1PreviewPredicate(p)) ?? []
    }
  }

  @Expose({ name: '@type' })
  @IsValidMessageType(DidCommPresentationV1Preview.type)
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public readonly type = DidCommPresentationV1Preview.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/presentation-preview')

  @Type(() => DidCommPresentationV1PreviewAttribute)
  @ValidateNested({ each: true })
  @IsInstance(DidCommPresentationV1PreviewAttribute, { each: true })
  public attributes!: DidCommPresentationV1PreviewAttribute[]

  @Type(() => DidCommPresentationV1PreviewPredicate)
  @ValidateNested({ each: true })
  @IsInstance(DidCommPresentationV1PreviewPredicate, { each: true })
  public predicates!: DidCommPresentationV1PreviewPredicate[]

  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }
}
