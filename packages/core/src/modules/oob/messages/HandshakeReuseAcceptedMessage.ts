import { Equals } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface HandshakeReuseAcceptedMessageOptions {
  id?: string
  threadId: string
  parentThreadId: string
}

export class HandshakeReuseAcceptedMessage extends AgentMessage {
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

  @Equals(HandshakeReuseAcceptedMessage.type)
  public readonly type = HandshakeReuseAcceptedMessage.type
  public static readonly type = 'https://didcomm.org/out-of-band/1.1/handshake-reuse-accepted'
}
