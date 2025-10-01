import { DidCommMessage, IsValidMessageType, ReturnRouteTypes, parseMessageType } from '@credo-ts/didcomm'

export interface DummyRequestMessageOptions {
  id?: string
}

export class DummyRequestMessage extends DidCommMessage {
  public constructor(options: DummyRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
    }

    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DummyRequestMessage.type)
  public readonly type = DummyRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/dummy/1.0/request')
}
