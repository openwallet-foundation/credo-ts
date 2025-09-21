import { Expose } from 'class-transformer'
import { IsObject, IsString } from 'class-validator'

import { DidCommMessage } from '../../../DidCommMessage'
import { EncryptedDidCommMessage } from '../../../types'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommForwardMessageOptions {
  id?: string
  to: string
  message: EncryptedDidCommMessage
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0094-cross-domain-messaging/README.md#corerouting10forward
 */
export class DidCommForwardMessage extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  /**
   * Create new ForwardMessage instance.
   *
   * @param options
   */
  public constructor(options: DidCommForwardMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.to = options.to
      this.message = options.message
    }
  }

  @IsValidMessageType(DidCommForwardMessage.type)
  public readonly type = DidCommForwardMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/routing/1.0/forward')

  @IsString()
  public to!: string

  @Expose({ name: 'msg' })
  @IsObject()
  public message!: EncryptedDidCommMessage
}
