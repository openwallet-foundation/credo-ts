import { DidCommMessage } from '../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommHandshakeReuseMessageOptions {
  id?: string
  parentThreadId: string
}

export class DidCommHandshakeReuseMessage extends DidCommMessage {
  public constructor(options: DidCommHandshakeReuseMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.setThread({
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @IsValidMessageType(DidCommHandshakeReuseMessage.type)
  public readonly type = DidCommHandshakeReuseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/out-of-band/1.1/handshake-reuse')
}
