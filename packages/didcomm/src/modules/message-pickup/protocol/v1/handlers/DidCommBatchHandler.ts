import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMessagePickupV1Protocol } from '../DidCommMessagePickupV1Protocol'

import { DidCommOutboundMessageContext } from '../../../../../models'
import { DidCommBatchMessage } from '../messages'

export class DidCommBatchHandler implements DidCommMessageHandler {
  public supportedMessages = [DidCommBatchMessage]
  private messagePickupProtocol: DidCommMessagePickupV1Protocol

  public constructor(messagePickupProtocol: DidCommMessagePickupV1Protocol) {
    this.messagePickupProtocol = messagePickupProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommBatchHandler>) {
    const connection = messageContext.assertReadyConnection()
    const batchRequestMessage = await this.messagePickupProtocol.processBatch(messageContext)

    if (batchRequestMessage) {
      return new DidCommOutboundMessageContext(batchRequestMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
