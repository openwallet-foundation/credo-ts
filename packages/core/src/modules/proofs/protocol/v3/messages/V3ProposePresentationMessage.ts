import { Expose, Type } from 'class-transformer'
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { uuid } from '../../../../../utils/uuid'

export interface V3ProposePresentationMessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  attachments: V2Attachment[]
}

class V3ProposePresentationMessageBody {
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

export class V3ProposePresentationMessage extends DidCommV2Message {
  public constructor(options: V3ProposePresentationMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? uuid()
      this.body = new V3ProposePresentationMessageBody(options)
      this.attachments = options.attachments
    }
  }

  @IsValidMessageType(V3ProposePresentationMessage.type)
  public readonly type = V3ProposePresentationMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/3.0/propose-presentation')

  @IsObject()
  @ValidateNested()
  @Type(() => V3ProposePresentationMessageBody)
  public body!: V3ProposePresentationMessageBody

  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Array<V2Attachment>
}
