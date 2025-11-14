import type { DidCommMessageHandler } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import { DidCommOutboundMessageContext } from '../../../../../models'
import type { DidCommMessagePickupV2Protocol } from '../DidCommMessagePickupV2Protocol'
import { DidCommStatusV2Message } from '../messages'

export class DidCommStatusV2Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommStatusV2Message]
  private messagePickupProtocol: DidCommMessagePickupV2Protocol

  public constructor(messagePickupProtocol: DidCommMessagePickupV2Protocol) {
    this.messagePickupProtocol = messagePickupProtocol
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommStatusV2Message>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryRequestMessage = await this.messagePickupProtocol.processStatus(messageContext)

    if (deliveryRequestMessage) {
      return new DidCommOutboundMessageContext(deliveryRequestMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
