import type { DummyService } from '../services'
import type { Handler, HandlerInboundMessage } from '@aries-framework/core'

import { OutboundMessageContext } from '@aries-framework/core'

import { DummyRequestMessage } from '../messages'

export class DummyRequestHandler implements Handler {
  public supportedMessages = [DummyRequestMessage]
  private dummyService: DummyService

  public constructor(dummyService: DummyService) {
    this.dummyService = dummyService
  }

  public async handle(inboundMessage: HandlerInboundMessage<DummyRequestHandler>) {
    const connection = inboundMessage.assertReadyConnection()
    const responseMessage = await this.dummyService.processRequest(inboundMessage)

    if (responseMessage) {
      return new OutboundMessageContext(responseMessage, { agentContext: inboundMessage.agentContext, connection })
    }
  }
}
