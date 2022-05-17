import type { AckMessageOptions } from '../../common'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'
import { AckMessage } from '../../common'

export type PresentationAckMessageOptions = AckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class PresentationAckMessage extends AckMessage {
  public constructor(options: PresentationAckMessageOptions) {
    super(options)
  }

  @IsValidMessageType(PresentationAckMessage.type)
  public readonly type = PresentationAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/ack')
}
