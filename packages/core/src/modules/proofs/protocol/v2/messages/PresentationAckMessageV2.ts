import { Equals } from 'class-validator'
import { PresentationAckMessageOptions } from '../..'
import { AckMessage } from '../../../common'
import { PresentationAckMessage } from '../../messages/PresentationAckMessage'

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
