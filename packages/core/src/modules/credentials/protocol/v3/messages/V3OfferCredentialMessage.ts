import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

import { V3CredentialPreview } from './V3CredentialPreview'

export interface V3OfferCredentialMessageOptions {
  id?: string
  attachments: V2Attachment[]
  credentialPreview: V3CredentialPreview
  replacementId?: string
  comment?: string
}

class V3OfferCredentialMessageBody {
  public constructor(options: {
    goalCode?: string
    comment?: string
    credentialPreview?: V3CredentialPreview
    replacementId?: string
  }) {
    if (options) {
      this.comment = options.comment
      this.credentialPreview = options.credentialPreview
      this.goalCode = options.goalCode
      this.replacementId = options.replacementId
    }
  }

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'goal_code' })
  @IsString()
  @IsOptional()
  public goalCode?: string

  @Expose({ name: 'credential_preview' })
  @Type(() => V3CredentialPreview)
  @ValidateNested()
  @IsInstance(V3CredentialPreview)
  public credentialPreview?: V3CredentialPreview

  @Expose({ name: 'replacement_id' })
  @IsString()
  @IsOptional()
  public replacementId?: string
}

export class V3OfferCredentialMessage extends DidCommV2Message {
  public constructor(options: V3OfferCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.body = new V3OfferCredentialMessageBody(options)
      this.attachments = options.attachments
    }
  }

  @IsValidMessageType(V3OfferCredentialMessage.type)
  public readonly type = V3OfferCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/offer-credential')

  @IsObject()
  @ValidateNested()
  @Type(() => V3OfferCredentialMessageBody)
  public body!: V3OfferCredentialMessageBody

  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V2Attachment, { each: true })
  public attachments!: V2Attachment[]
}
