import { DIDCommV1Message, IsValidMessageType, parseMessageType } from '@aries-framework/core'

export interface MenuRequestMessageOptions {
  id?: string
}

export class MenuRequestMessage extends DIDCommV1Message {
  public constructor(options: MenuRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
    }
  }

  @IsValidMessageType(MenuRequestMessage.type)
  public readonly type = MenuRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/action-menu/1.0/menu-request')
}
