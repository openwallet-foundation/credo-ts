import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { DummyService } from '../services'

import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'

import { DummyRequestMessage } from '../messages'

export class DummyRequestHandler implements DidCommMessageHandler {
  public supportedMessages = [DummyRequestMessage]
  private dummyService: DummyService

  public constructor(dummyService: DummyService) {
    this.dummyService = dummyService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DummyRequestHandler>) {
    const connectionRecord = inboundMessage.assertReadyConnection()
    const responseMessage = await this.dummyService.processRequest(inboundMessage)

    if (responseMessage) {
      return getOutboundDidCommMessageContext(inboundMessage.agentContext, {
        connectionRecord,
        message: responseMessage,
      })
    }
  }
}
