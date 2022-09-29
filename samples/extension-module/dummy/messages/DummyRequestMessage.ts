import { DIDCommV1Message } from '@aries-framework/core'
import { Equals } from 'class-validator'
import { AgentMessage, IsValidMessageType, parseMessageType } from '@aries-framework/core'

export interface DummyRequestMessageOptions {
  id?: string
}

export class DummyRequestMessage extends DIDCommV1Message {
  public constructor(options: DummyRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
    }
  }

  @IsValidMessageType(DummyRequestMessage.type)
  public readonly type = DummyRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/dummy/1.0/request')
}
