import type { PresentationAckMessage, PresentationAckMessageOptions } from '../../../messages/PresentationAckMessage'

import { Equals } from 'class-validator'

import { AckMessage } from '../../../../common/messages/AckMessage'

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class V2PresentationAckMessage extends AckMessage implements PresentationAckMessage {
  public constructor(options: PresentationAckMessageOptions) {
    super(options)
  }

  @Equals(V2PresentationAckMessage.type)
  public readonly type = V2PresentationAckMessage.type
  public static readonly type = 'https://didcomm.org/present-proof/2.0/ack'
}
