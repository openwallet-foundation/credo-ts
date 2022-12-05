import { DidCommV1Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export interface HandshakeReuseAcceptedMessageOptions {
  id?: string
  threadId: string
  parentThreadId: string
}

export class HandshakeReuseAcceptedMessage extends DidCommV1Message {
  public constructor(options: HandshakeReuseAcceptedMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.setThread({
        threadId: options.threadId,
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @IsValidMessageType(HandshakeReuseAcceptedMessage.type)
  public readonly type = HandshakeReuseAcceptedMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/out-of-band/1.1/handshake-reuse-accepted')
}
