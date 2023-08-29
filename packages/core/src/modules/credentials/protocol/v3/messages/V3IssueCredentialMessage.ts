import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export interface V3IssueCredentialMessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  replacementId?: string
  attachments: V2Attachment[]
}

class V3IssueCredentialMessageBody {
  public constructor(options: { goalCode?: string; comment?: string; replacementId?: string }) {
    if (options) {
      this.comment = options.comment
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

  @Expose({ name: 'replacement_id' })
  @IsString()
  @IsOptional()
  public replacementId?: string
}

export class V3IssueCredentialMessage extends DidCommV2Message {
  public constructor(options: V3IssueCredentialMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.body = new V3IssueCredentialMessageBody(options)
      this.attachments = options.attachments
    }
  }
  @IsValidMessageType(V3IssueCredentialMessage.type)
  public readonly type = V3IssueCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/issue-credential')

  @IsObject()
  @ValidateNested()
  @Type(() => V3IssueCredentialMessageBody)
  public body!: V3IssueCredentialMessageBody

  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V2Attachment, { each: true })
  public attachments!: V2Attachment[]
}
