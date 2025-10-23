import { DidCommAckMessage, type DidCommAckMessageOptions } from '../../../../../messages'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export type DidCommCredentialV2AckMessageOptions = DidCommAckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class DidCommCredentialV2AckMessage extends DidCommAckMessage {
  @IsValidMessageType(DidCommCredentialV2AckMessage.type)
  public readonly type = DidCommCredentialV2AckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/ack')
}
