import { Type } from 'class-transformer'
import { IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator'

import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

class V2BasicMessageBody {
  public constructor(options: { content: string }) {
    if (options) {
      this.content = options.content
    }
  }
  @IsString()
  public content!: string
}

export class V2BasicMessage extends DidCommV2Message {
  public readonly allowDidSovPrefix = false

  @IsNotEmpty()
  public createdTime!: number

  @IsObject()
  @ValidateNested()
  @Type(() => V2BasicMessageBody)
  public body!: V2BasicMessageBody

  /**
   * Create new BasicMessage instance.
   * sentTime will be assigned to new Date if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  public constructor(options: { content: string; sentTime?: Date; id?: string; locale?: string }) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.createdTime = options.sentTime?.getTime() || new Date().getTime()
      this.body = new V2BasicMessageBody({ content: options.content })
      this.language = options.locale || 'en'
    }
  }

  public get content() {
    return this.body.content
  }

  @IsValidMessageType(V2BasicMessage.type)
  public readonly type = V2BasicMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/basicmessage/2.0/message')
}
