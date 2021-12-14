import type { AckMessageOptions } from '../../../common'

import { Equals } from 'class-validator'

import { AckMessage } from '../../../common'

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
  public static readonly type = 'https://didcomm.org/present-proof/1.0/ack'
}
