import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { ActionMenuService } from '../services'

import { PerformMessage } from '../messages'

/**
 * @internal
 */
export class PerformMessageHandler implements DidCommMessageHandler {
  private actionMenuService: ActionMenuService
  public supportedMessages = [PerformMessage]

  public constructor(actionMenuService: ActionMenuService) {
    this.actionMenuService = actionMenuService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<PerformMessageHandler>) {
    inboundMessage.assertReadyConnection()

    await this.actionMenuService.processPerform(inboundMessage)

    return undefined
  }
}
