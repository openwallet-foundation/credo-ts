import { Equals } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface HandshakeReuseMessageOptions {
  id?: string
  parentThreadId: string
}

export class HandshakeReuseMessage extends AgentMessage {
  public constructor(options: HandshakeReuseMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.setThread({
        threadId: this.id,
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @Equals(HandshakeReuseMessage.type)
  public readonly type = HandshakeReuseMessage.type
  public static readonly type = 'https://didcomm.org/out-of-band/1.1/handshake-reuse'
}
