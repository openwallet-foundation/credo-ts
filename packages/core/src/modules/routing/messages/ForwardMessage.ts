import { Expose } from 'class-transformer'
import { Equals, IsObject, IsString } from 'class-validator'

import { EncryptedMessage } from '../../../agent/didcomm/types'
import { DIDCommV1Message } from '../../../agent/didcomm/v1/DIDCommV1Message'

export interface ForwardMessageOptions {
  id?: string
  to: string
  message: EncryptedMessage
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0094-cross-domain-messaging/README.md#corerouting10forward
 */
export class ForwardMessage extends DIDCommV1Message {
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

  @Equals(ForwardMessage.type)
  public readonly type = ForwardMessage.type
  public static readonly type = 'https://didcomm.org/routing/1.0/forward'

  @IsString()
  public to!: string

  @Expose({ name: 'msg' })
  @IsObject()
  public message!: EncryptedMessage
}
