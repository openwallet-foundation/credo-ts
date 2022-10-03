import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ActionMenuService } from '../services'

import { PerformMessage } from '../messages'

export class PerformMessageHandler implements Handler {
  private actionMenuService: ActionMenuService
  public supportedMessages = [PerformMessage]

  public constructor(actionMenuService: ActionMenuService) {
    this.actionMenuService = actionMenuService
  }

  public async handle(inboundMessage: HandlerInboundMessage<PerformMessageHandler>) {
    inboundMessage.assertReadyConnection()

    await this.actionMenuService.processPerform(inboundMessage)
  }
}
