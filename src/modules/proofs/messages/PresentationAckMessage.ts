import { Equals } from 'class-validator'

import { AckMessage, AckMessageOptions } from '../../common'
import { PresentProofMessageType } from './PresentProofMessageType'

export type PresentationAckMessageOptions = AckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class PresentationAckMessage extends AckMessage {
  public constructor(options: PresentationAckMessageOptions) {
    super(options)
  }

  @Equals(PresentationAckMessage.type)
  public readonly type = PresentationAckMessage.type
  public static readonly type = PresentProofMessageType.PresentationAck
}
