import { Equals } from 'class-validator'
import { IssueCredentialMessageType } from './IssueCredentialMessageType'

import { AckMessage, AckMessageOptions } from '../../common'

export type CredentialAckMessageOptions = AckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class CredentialAckMessage extends AckMessage {
  /**
   * Create new CredentialAckMessage instance.
   * @param options
   */
  public constructor(options: CredentialAckMessageOptions) {
    super(options)
  }

  @Equals(CredentialAckMessage.type)
  public readonly type = CredentialAckMessage.type
  public static readonly type = IssueCredentialMessageType.CredentialAck
}
