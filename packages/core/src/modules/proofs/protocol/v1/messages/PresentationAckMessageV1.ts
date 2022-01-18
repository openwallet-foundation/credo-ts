import type { AckMessageOptions } from '../../../../common'

import { Equals } from 'class-validator'

import { AckMessage } from '../../../../common'

export type PresentationAckMessageOptions = AckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class PresentationAckMessageV1 extends AckMessage {
  public constructor(options: PresentationAckMessageOptions) {
    super(options)
  }

  @Equals(PresentationAckMessageV1.type)
  public readonly type = PresentationAckMessageV1.type
  public static readonly type = 'https://didcomm.org/present-proof/1.0/ack'
}
