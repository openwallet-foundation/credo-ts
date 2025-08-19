import type { DidCommMessageHandler } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { V2DidCommMessagePickupProtocol } from '../V2DidCommMessagePickupProtocol'

import { OutboundDidCommMessageContext } from '../../../../../models'
import { V2StatusMessage } from '../messages'

export class V2StatusHandler implements DidCommMessageHandler {
  public supportedMessages = [V2StatusMessage]
  private messagePickupProtocol: V2DidCommMessagePickupProtocol

  public constructor(messagePickupProtocol: V2DidCommMessagePickupProtocol) {
    this.messagePickupProtocol = messagePickupProtocol
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2StatusMessage>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryRequestMessage = await this.messagePickupProtocol.processStatus(messageContext)

    if (deliveryRequestMessage) {
      return new OutboundDidCommMessageContext(deliveryRequestMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
