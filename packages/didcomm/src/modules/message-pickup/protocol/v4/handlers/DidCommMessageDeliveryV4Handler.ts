import { DidCommMessageSender } from '../../../../../DidCommMessageSender'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../../models'
import { DidCommMessagePickupModuleConfig } from '../../../DidCommMessagePickupModuleConfig'
import type { DidCommMessagePickupV4Protocol } from '../DidCommMessagePickupV4Protocol'
import { DidCommDeliveryRequestV4Message, DidCommMessageDeliveryV4Message } from '../messages'

export class DidCommMessageDeliveryV4Handler implements DidCommMessageHandler {
  public supportedMessages = [DidCommMessageDeliveryV4Message]
  private protocol: DidCommMessagePickupV4Protocol

  public constructor(protocol: DidCommMessagePickupV4Protocol) {
    this.protocol = protocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMessageDeliveryV4Handler>) {
    const { agentContext, message } = messageContext
    const connection = messageContext.assertReadyConnection()

    const messagesReceived = await this.protocol.processDelivery(messageContext)
    // Empty delivery: the queue is drained (processDelivery emitted completion). Nothing to ack or request.
    if (!messagesReceived) return undefined

    // Pickup 4.0: messages-received is a fire-and-forget ack, so send it on its own.
    const messageSender = agentContext.dependencyManager.resolve(DidCommMessageSender)
    await messageSender.sendMessage(new DidCommOutboundMessageContext(messagesReceived, { agentContext, connection }))

    // Keep draining with the next delivery-request. Live Mode deliveries are pushed (no thread) and don't continue.
    if (message.thread?.threadId === undefined) return undefined

    const { maximumBatchSize } = agentContext.dependencyManager.resolve(DidCommMessagePickupModuleConfig)
    const deliveryRequest = new DidCommDeliveryRequestV4Message({
      messageCountLimit: maximumBatchSize,
      recipientDid: message.recipientDid,
    })
    return new DidCommOutboundMessageContext(deliveryRequest, { agentContext, connection })
  }
}
