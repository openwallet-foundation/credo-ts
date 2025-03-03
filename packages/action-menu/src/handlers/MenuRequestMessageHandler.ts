import type { MessageHandler, MessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { ActionMenuService } from '../services'

import { MenuRequestMessage } from '../messages'

/**
 * @internal
 */
export class MenuRequestMessageHandler implements MessageHandler {
  private actionMenuService: ActionMenuService
  public supportedMessages = [MenuRequestMessage]

  public constructor(actionMenuService: ActionMenuService) {
    this.actionMenuService = actionMenuService
  }

  public async handle(inboundMessage: MessageHandlerInboundMessage<MenuRequestMessageHandler>) {
    inboundMessage.assertReadyConnection()

    await this.actionMenuService.processRequest(inboundMessage)

    return undefined
  }
}
