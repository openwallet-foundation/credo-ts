import type { AckMessageOptions } from '../../../../common'

import { Equals } from 'class-validator'

import { AckMessage } from '../../../../common'

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class V1PresentationAckMessage extends AckMessage {
  public constructor(options: AckMessageOptions) {
    super(options)
  }

  @Equals(V1PresentationAckMessage.type)
  public readonly type = V1PresentationAckMessage.type
  public static readonly type = 'https://didcomm.org/present-proof/1.0/ack'
}
