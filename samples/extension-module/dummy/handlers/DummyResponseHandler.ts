import type { DummyService } from '../services'
import type { Handler, HandlerInboundMessage } from '@aries-framework/core'

import { DummyResponseMessage } from '../messages'

export class DummyResponseHandler implements Handler {
  public supportedMessages = [DummyResponseMessage]
  private dummyService: DummyService

  public constructor(dummyService: DummyService) {
    this.dummyService = dummyService
  }

  public async handle(inboundMessage: HandlerInboundMessage<DummyResponseHandler>) {
    inboundMessage.assertReadyConnection()

    await this.dummyService.processResponse(inboundMessage)
  }
}
