import { DidCommV1Message, IsValidMessageType, parseMessageType } from '@aries-framework/core'

/**
 * @internal
 */
export interface MenuRequestMessageOptions {
  id?: string
}

/**
 * @internal
 */
export class MenuRequestMessage extends DidCommV1Message {
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
