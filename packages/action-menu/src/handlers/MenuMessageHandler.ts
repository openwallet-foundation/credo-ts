import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { MenuMessage } from '../messages'
import type { ActionMenuService } from '../services'

/**
 * @internal
 */
export class MenuMessageHandler implements DidCommMessageHandler {
  private actionMenuService: ActionMenuService
  public supportedMessages = [MenuMessage]

  public constructor(actionMenuService: ActionMenuService) {
    this.actionMenuService = actionMenuService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<MenuMessageHandler>) {
    inboundMessage.assertReadyConnection()

    await this.actionMenuService.processMenu(inboundMessage)

    return undefined
  }
}
