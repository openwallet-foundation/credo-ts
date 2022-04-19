import type { AckMessageOptions } from '../../common'

import { Equals } from 'class-validator'

import { AckMessage } from '../../common'
import { parseMessageType } from '../../../utils/messageType'

export type PresentationAckMessageOptions = AckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class PresentationAckMessage extends AckMessage {
  public constructor(options: PresentationAckMessageOptions) {
    super(options)
  }

  @Equals(PresentationAckMessage.type)
  public readonly type = PresentationAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/ack')
}
