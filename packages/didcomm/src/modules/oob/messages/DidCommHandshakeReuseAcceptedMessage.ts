import { DidCommMessage } from '../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommHandshakeReuseAcceptedMessageOptions {
  id?: string
  threadId: string
  parentThreadId: string
}

export class DidCommHandshakeReuseAcceptedMessage extends DidCommMessage {
  public constructor(options: DidCommHandshakeReuseAcceptedMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.setThread({
        threadId: options.threadId,
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @IsValidMessageType(DidCommHandshakeReuseAcceptedMessage.type)
  public readonly type = DidCommHandshakeReuseAcceptedMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/out-of-band/1.1/handshake-reuse-accepted')
}
