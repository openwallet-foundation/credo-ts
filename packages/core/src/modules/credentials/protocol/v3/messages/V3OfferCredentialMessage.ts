import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

import { V3CredentialPreview } from './V3CredentialPreview'

export interface V3OfferCredentialMessageOptions {
  id?: string
  formats: CredentialFormatSpec[]
  offerAttachments: V2Attachment[]
  credentialPreview: V3CredentialPreview
  replacementId?: string
  comment?: string
}

export class V3OfferCredentialMessage extends DidCommV2Message {
  public constructor(options: V3OfferCredentialMessageOptions) {
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

  @IsValidMessageType(V3OfferCredentialMessage.type)
  public readonly type = V3OfferCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/offer-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credential_preview' })
  @Type(() => V3CredentialPreview)
  @ValidateNested()
  @IsInstance(V3CredentialPreview)
  public credentialPreview?: V3CredentialPreview

  @Expose({ name: 'offers~attach' })
  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V2Attachment, { each: true })
  public offerAttachments!: V2Attachment[]

  @Expose({ name: 'replacement_id' })
  @IsString()
  @IsOptional()
  public replacementId?: string

  public getOfferAttachmentById(id: string): V2Attachment | undefined {
    return this.offerAttachments.find((attachment) => attachment.id === id)
  }
}
