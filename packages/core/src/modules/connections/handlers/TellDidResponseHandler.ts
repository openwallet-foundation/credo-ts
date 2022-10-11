import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { TellDidService } from '../services'

import { TellDidResponseMessage } from '../messages'

export class TellDidResponseHandler implements Handler {
  private tellDidService: TellDidService
  public supportedMessages = [TellDidResponseMessage]

  public constructor(tellDidService: TellDidService) {
    this.tellDidService = tellDidService
  }

  public async handle(messageContext: HandlerInboundMessage<TellDidResponseHandler>) {
    return this.tellDidService.receiveTellDidResponse(messageContext)
  }
}
