import type { AckMessageOptions } from '../../../../common'

import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
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

  @IsValidMessageType(V1CredentialAckMessage.type)
  public readonly type = V1CredentialAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/ack')
}
