import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export interface RotateMessageOptions {
  id?: string
  did: string
}

/**
 * Message to communicate the DID a party wish to rotate to.
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/main/features/0794-did-rotate#rotate
 */
export class RotateMessage extends AgentMessage {
  /**
   * Create new RotateMessage instance.
   * @param options
   */
  public constructor(options: RotateMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.did = options.did
    }
  }

  @IsValidMessageType(RotateMessage.type)
  public readonly type = RotateMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/did-rotate/1.0/rotate')

  @Expose({ name: 'to_did' })
  @IsString()
  public readonly did!: string
}
