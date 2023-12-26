import type { AckMessageOptions } from '../../common/messages/AckMessage'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'
import { AckMessage } from '../../common/messages/AckMessage'

export type RotateAckMessageOptions = AckMessageOptions

export class RotateAckMessage extends AckMessage {
  /**
   * Create new CredentialAckMessage instance.
   * @param options
   */
  public constructor(options: RotateAckMessageOptions) {
    super(options)
  }

  @IsValidMessageType(RotateAckMessage.type)
  public readonly type = RotateAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/did-rotate/1.0/ack')
}
