import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { ActionMenuService } from '../services'

import { MenuRequestMessage } from '../messages'

/**
 * @internal
 */
export class MenuRequestMessageHandler implements DidCommMessageHandler {
  private actionMenuService: ActionMenuService
  public supportedMessages = [MenuRequestMessage]

  public constructor(actionMenuService: ActionMenuService) {
    this.actionMenuService = actionMenuService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<MenuRequestMessageHandler>) {
    inboundMessage.assertReadyConnection()

    await this.actionMenuService.processRequest(inboundMessage)

    return undefined
  }
}
