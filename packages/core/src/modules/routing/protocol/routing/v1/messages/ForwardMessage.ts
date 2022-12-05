import { Expose } from 'class-transformer'
import { IsObject, IsString } from 'class-validator'

import { EncryptedMessage } from '../../../../../../didcomm/types'
import { DidCommV1Message } from '../../../../../../didcomm/versions/v1'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export interface ForwardMessageOptions {
  id?: string
  to: string
  message: EncryptedMessage
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0094-cross-domain-messaging/README.md#corerouting10forward
 */
export class ForwardMessage extends DidCommV1Message {
  /**
   * Create new ForwardMessage instance.
   *
   * @param options
   */
  public constructor(options: ForwardMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.to = options.to
      this.message = options.message
    }
  }

  @IsValidMessageType(ForwardMessage.type)
  public readonly type = ForwardMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/routing/1.0/forward')

  @IsString()
  public to!: string

  @Expose({ name: 'msg' })
  @IsObject()
  public message!: EncryptedMessage
}
