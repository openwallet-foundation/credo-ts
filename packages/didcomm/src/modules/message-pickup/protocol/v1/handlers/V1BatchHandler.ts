import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V1MessagePickupProtocol } from '../V1MessagePickupProtocol'

import { OutboundDidCommMessageContext } from '../../../../../models'
import { V1BatchMessage } from '../messages'

export class V1BatchHandler implements DidCommMessageHandler {
  public supportedMessages = [V1BatchMessage]
  private messagePickupProtocol: V1MessagePickupProtocol

  public constructor(messagePickupProtocol: V1MessagePickupProtocol) {
    this.messagePickupProtocol = messagePickupProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1BatchHandler>) {
    const connection = messageContext.assertReadyConnection()
    const batchRequestMessage = await this.messagePickupProtocol.processBatch(messageContext)

    if (batchRequestMessage) {
      return new OutboundDidCommMessageContext(batchRequestMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
