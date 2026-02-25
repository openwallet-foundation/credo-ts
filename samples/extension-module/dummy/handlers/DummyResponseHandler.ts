import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DummyResponseMessage } from '../messages'
import type { DummyService } from '../services'

export class DummyResponseHandler implements DidCommMessageHandler {
  public supportedMessages = [DummyResponseMessage]
  private dummyService: DummyService

  public constructor(dummyService: DummyService) {
    this.dummyService = dummyService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DummyResponseHandler>) {
    inboundMessage.assertReadyConnection()

    await this.dummyService.processResponse(inboundMessage)

    return undefined
  }
}
