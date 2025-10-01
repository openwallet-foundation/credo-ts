import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { DidCommCredentialFormatSpec } from '../../../models'

import { DidCommCredentialV2Preview } from './DidCommCredentialV2Preview'

export interface DidCommOfferCredentialV2MessageOptions {
  id?: string
  formats: DidCommCredentialFormatSpec[]
  offerAttachments: DidCommAttachment[]
  credentialPreview: DidCommCredentialV2Preview
  replacementId?: string
  comment?: string
  goalCode?: string
  goal?: string
}

export class DidCommOfferCredentialV2Message extends DidCommMessage {
  public constructor(options: DidCommOfferCredentialV2MessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.goal = options.goal
      this.formats = options.formats
      this.credentialPreview = options.credentialPreview
      this.offerAttachments = options.offerAttachments
    }
  }

  @Type(() => DidCommCredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  @IsInstance(DidCommCredentialFormatSpec, { each: true })
  public formats!: DidCommCredentialFormatSpec[]

  @IsValidMessageType(DidCommOfferCredentialV2Message.type)
  public readonly type = DidCommOfferCredentialV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/offer-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'goal_code' })
  @IsString()
  @IsOptional()
  public goalCode?: string

  @IsString()
  @IsOptional()
  public goal?: string

  @IsOptional()
  @Expose({ name: 'credential_preview' })
  @Type(() => DidCommCredentialV2Preview)
  @ValidateNested()
  @IsInstance(DidCommCredentialV2Preview)
  public credentialPreview?: DidCommCredentialV2Preview

  @Expose({ name: 'offers~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  public offerAttachments!: DidCommAttachment[]

  @Expose({ name: 'replacement_id' })
  @IsString()
  @IsOptional()
  public replacementId?: string

  public getOfferAttachmentById(id: string): DidCommAttachment | undefined {
    return this.offerAttachments.find((attachment) => attachment.id === id)
  }
}
