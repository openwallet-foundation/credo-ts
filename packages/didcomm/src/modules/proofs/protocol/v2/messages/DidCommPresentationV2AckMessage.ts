import { DidCommAckMessage } from '../../../../../messages'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export class DidCommPresentationV2AckMessage extends DidCommAckMessage {
  @IsValidMessageType(DidCommPresentationV2AckMessage.type)
  public readonly type = DidCommPresentationV2AckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/2.0/ack')
}
