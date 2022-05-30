import type { DummyService } from '../services'
import type { Handler, HandlerInboundMessage } from '@aries-framework/core'
import type { DIDCommV1Message } from '@aries-framework/core/src/agent/didcomm'

import { DummyResponseMessage } from '../messages'

export class DummyResponseHandler implements Handler<typeof DIDCommV1Message> {
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
