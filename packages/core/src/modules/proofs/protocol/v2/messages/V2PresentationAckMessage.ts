import type { PresentationAckMessage, PresentationAckMessageOptions } from '../../../messages/PresentationAckMessage'

import { Equals } from 'class-validator'

import { AckMessage } from '../../../../common/messages/AckMessage'

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class PresentationAckMessageV2 extends AckMessage implements PresentationAckMessage {
  public constructor(options: PresentationAckMessageOptions) {
    super(options)
  }

  @Equals(PresentationAckMessageV2.type)
  public readonly type = PresentationAckMessageV2.type
  public static readonly type = 'https://didcomm.org/present-proof/2.0/ack'
}
