import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { TellDidService } from '../services'

import { TellDidMessage } from '../messages'

export class TellDidMessageHandler implements Handler {
  private tellDidService: TellDidService
  public supportedMessages = [TellDidMessage]

  public constructor(tellDidService: TellDidService) {
    this.tellDidService = tellDidService
  }

  public async handle(messageContext: HandlerInboundMessage<TellDidMessageHandler>) {
    return this.tellDidService.receiveTellDidMessage(messageContext)
  }
}
