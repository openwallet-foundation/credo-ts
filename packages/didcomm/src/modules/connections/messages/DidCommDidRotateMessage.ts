import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

import { DidCommMessage } from '../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommDidRotateMessageOptions {
  id?: string
  toDid: string
}

/**
 * Message to communicate the DID a party wish to rotate to.
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/main/features/0794-did-rotate#rotate
 */
export class DidCommDidRotateMessage extends DidCommMessage {
  /**
   * Create new RotateMessage instance.
   * @param options
   */
  public constructor(options: DidCommDidRotateMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.toDid = options.toDid
    }
  }

  @IsValidMessageType(DidCommDidRotateMessage.type)
  public readonly type = DidCommDidRotateMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/did-rotate/1.0/rotate')

  @Expose({ name: 'to_did' })
  @IsString()
  public readonly toDid!: string
}
