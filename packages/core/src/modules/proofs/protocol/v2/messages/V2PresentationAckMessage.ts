import type { PresentationAckMessageOptions } from '../../../messages/PresentationAckMessage'

import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { AckMessage } from '../../../../common/messages/AckMessage'

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class V2PresentationAckMessage extends AckMessage {
  public constructor(options: PresentationAckMessageOptions) {
    super(options)
  }

  @IsValidMessageType(V2PresentationAckMessage.type)
  public readonly type = V2PresentationAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/2.0/ack')
}
