import type { DidCommAckMessageOptions } from '../../../messages'

import { DidCommAckMessage } from '../../../messages'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export type DidCommDidRotateAckMessageOptions = DidCommAckMessageOptions

export class DidCommDidRotateAckMessage extends DidCommAckMessage {
  @IsValidMessageType(DidCommDidRotateAckMessage.type)
  public readonly type = DidCommDidRotateAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/did-rotate/1.0/ack')
}
