import type { DummyService } from '../services'
import type { Handler, HandlerInboundMessage } from '@aries-framework/core'

import { DummyRequestMessage } from '../messages'

export class DummyRequestHandler implements Handler {
  public supportedMessages = [DummyRequestMessage]
  private dummyService: DummyService

  public constructor(dummyService: DummyService) {
    this.dummyService = dummyService
  }

  public async handle(inboundMessage: HandlerInboundMessage<DummyRequestHandler>) {
    inboundMessage.assertReadyConnection()

    await this.dummyService.processRequest(inboundMessage)
  }
}
