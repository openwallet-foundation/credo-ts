import type { ActionMenuService } from '../services'
import type { Handler, HandlerInboundMessage } from '@aries-framework/core'

import { MenuRequestMessage } from '../messages'

export class MenuRequestMessageHandler implements Handler {
  private actionMenuService: ActionMenuService
  public supportedMessages = [MenuRequestMessage]

  public constructor(actionMenuService: ActionMenuService) {
    this.actionMenuService = actionMenuService
  }

  public async handle(inboundMessage: HandlerInboundMessage<MenuRequestMessageHandler>) {
    inboundMessage.assertReadyConnection()

    await this.actionMenuService.processRequest(inboundMessage)
  }
}
