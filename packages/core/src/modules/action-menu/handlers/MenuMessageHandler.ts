import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ActionMenuService } from '../services'

import { MenuMessage } from '../messages'

export class MenuMessageHandler implements Handler {
  private actionMenuService: ActionMenuService
  public supportedMessages = [MenuMessage]

  public constructor(actionMenuService: ActionMenuService) {
    this.actionMenuService = actionMenuService
  }

  public async handle(inboundMessage: HandlerInboundMessage<MenuMessageHandler>) {
    inboundMessage.assertReadyConnection()

    await this.actionMenuService.processMenu(inboundMessage)
  }
}
