import type { AckMessageOptions } from '../../../../didcomm'

import { AckMessage, IsValidMessageType, parseMessageType } from '../../../../didcomm'

export type V2CredentialAckMessageOptions = AckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class V2CredentialAckMessage extends AckMessage {
  /**
   * Create new CredentialAckMessage instance.
   * @param options
   */
  public constructor(options: V2CredentialAckMessageOptions) {
    super(options)
  }

  @IsValidMessageType(V2CredentialAckMessage.type)
  public readonly type = V2CredentialAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/ack')
}
