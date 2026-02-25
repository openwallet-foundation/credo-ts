import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { AckDecorator } from '../../../../../decorators/ack/AckDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommRevocationNotificationV1MessageOptions {
  issueThread: string
  id?: string
  comment?: string
  pleaseAck?: AckDecorator
}

export class DidCommRevocationNotificationV1Message extends DidCommMessage {
  public constructor(options: DidCommRevocationNotificationV1MessageOptions) {
    super()
    if (options) {
      this.issueThread = options.issueThread
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.pleaseAck = options.pleaseAck
    }
  }

  @IsValidMessageType(DidCommRevocationNotificationV1Message.type)
  public readonly type = DidCommRevocationNotificationV1Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/revocation_notification/1.0/revoke')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'thread_id' })
  @IsString()
  public issueThread!: string
}
