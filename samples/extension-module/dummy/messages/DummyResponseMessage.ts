import { AgentMessage, IsValidMessageType, parseMessageType } from '@aries-framework/core'

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

  @IsValidMessageType(DummyResponseMessage.type)
  public readonly type = DummyResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://2060.io/didcomm/dummy/1.0/response')
}
