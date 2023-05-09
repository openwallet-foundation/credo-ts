import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V1Attachment } from '../../../../../decorators/attachment/V1Attachment'
import { DidCommV1Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

import { V2CredentialPreview } from './V2CredentialPreview'

export interface V2OfferCredentialMessageOptions {
  id?: string
  formats: CredentialFormatSpec[]
  offerAttachments: V1Attachment[]
  credentialPreview: V2CredentialPreview
  replacementId?: string
  comment?: string
}

export class V2OfferCredentialMessage extends DidCommV1Message {
  public constructor(options: V2OfferCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.credentialPreview = options.credentialPreview
      this.offerAttachments = options.offerAttachments
    }
  }

  @Type(() => CredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  @IsInstance(CredentialFormatSpec, { each: true })
  public formats!: CredentialFormatSpec[]

  @IsValidMessageType(V2OfferCredentialMessage.type)
  public readonly type = V2OfferCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/offer-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credential_preview' })
  @Type(() => V2CredentialPreview)
  @ValidateNested()
  @IsInstance(V2CredentialPreview)
  public credentialPreview?: V2CredentialPreview

  @Expose({ name: 'offers~attach' })
  @Type(() => V1Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V1Attachment, { each: true })
  public offerAttachments!: V1Attachment[]

  @Expose({ name: 'replacement_id' })
  @IsString()
  @IsOptional()
  public replacementId?: string

  public getOfferAttachmentById(id: string): V1Attachment | undefined {
    return this.offerAttachments.find((attachment) => attachment.id === id)
  }
}
