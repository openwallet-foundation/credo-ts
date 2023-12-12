import type { MessageHandler } from '../../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { V2MessagePickupProtocol } from '../V2MessagePickupProtocol'

import { OutboundMessageContext } from '../../../../../agent/models'
import { V2StatusMessage } from '../messages'

export class V2StatusHandler implements MessageHandler {
  public supportedMessages = [V2StatusMessage]
  private messagePickupService: V2MessagePickupProtocol

  public constructor(messagePickupService: V2MessagePickupProtocol) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundMessageContext<V2StatusMessage>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryRequestMessage = await this.messagePickupService.processStatus(messageContext)

    if (deliveryRequestMessage) {
      return new OutboundMessageContext(deliveryRequestMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
