import type { AckMessageOptions } from '../../../../common'

import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { AckMessage } from '../../../../common'

export type V3CredentialAckMessageOptions = AckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class V3CredentialAckMessage extends AckMessage {
  /**
   * Create new CredentialAckMessage instance.
   * @param options
   */
  public constructor(options: V3CredentialAckMessageOptions) {
    super(options)
  }

  @IsValidMessageType(V3CredentialAckMessage.type)
  public readonly type = V3CredentialAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/ack')
}
