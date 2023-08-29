import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export interface V3RequestCredentialMessageOptions {
  id?: string
  attachments: V2Attachment[]
  comment?: string
  goalCode?: string
}

class V3RequestCredentialMessageBody {
  public constructor(options: { goalCode?: string; comment?: string }) {
    if (options) {
      this.comment = options.comment
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
}

export class V3RequestCredentialMessage extends DidCommV2Message {
  public constructor(options: V3RequestCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.body = new V3RequestCredentialMessageBody(options)
      this.attachments = options.attachments
    }
  }

  @IsValidMessageType(V3RequestCredentialMessage.type)
  public readonly type = V3RequestCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/request-credential')

  @IsObject()
  @ValidateNested()
  @Type(() => V3RequestCredentialMessageBody)
  public body!: V3RequestCredentialMessageBody

  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V2Attachment, { each: true })
  public attachments!: V2Attachment[]
}
