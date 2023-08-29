import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

import { V3CredentialPreview } from './V3CredentialPreview'

export interface V3ProposeCredentialMessageOptions {
  id?: string
  comment?: string
  credentialPreview?: V3CredentialPreview
  attachments: V2Attachment[]
}

class V3ProposeCredentialMessageBody {
  public constructor(options: { goalCode?: string; comment?: string; credentialPreview?: V3CredentialPreview }) {
    if (options) {
      this.comment = options.comment
      this.credentialPreview = options.credentialPreview
      this.goalCode = options.goalCode
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
  @IsOptional()
  @IsInstance(V3CredentialPreview)
  public credentialPreview?: V3CredentialPreview
}

export class V3ProposeCredentialMessage extends DidCommV2Message {
  public constructor(options: V3ProposeCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.body = new V3ProposeCredentialMessageBody(options)
      this.attachments = options.attachments
    }
  }

  @IsValidMessageType(V3ProposeCredentialMessage.type)
  public readonly type = V3ProposeCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/propose-credential')

  @IsObject()
  @ValidateNested()
  @Type(() => V3ProposeCredentialMessageBody)
  public body!: V3ProposeCredentialMessageBody

  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V2Attachment, { each: true })
  public attachments!: V2Attachment[]
}
