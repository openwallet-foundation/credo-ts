import { AgentMessage } from '@aries-framework/core'
import { Equals } from 'class-validator'

export interface DummyResponseMessageOptions {
  id?: string
  threadId: string
}

export class DummyResponseMessage extends AgentMessage {
  public constructor(options: DummyResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @Equals(DummyResponseMessage.type)
  public readonly type = DummyResponseMessage.type
  public static readonly type = 'https://2060.io/didcomm/dummy/response'
}
