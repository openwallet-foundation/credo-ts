import type { AckMessageOptions } from '../../../../common'

import { Equals } from 'class-validator'

import { AckMessage } from '../../../../common'

export type CredentialAckMessageOptions = AckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class V1CredentialAckMessage extends AckMessage {
  /**
   * Create new CredentialAckMessage instance.
   * @param options
   */
  public constructor(options: CredentialAckMessageOptions) {
    super(options)
  }

  @Equals(V1CredentialAckMessage.type)
  public readonly type = V1CredentialAckMessage.type
  public static readonly type = 'https://didcomm.org/issue-credential/1.0/ack'
}
