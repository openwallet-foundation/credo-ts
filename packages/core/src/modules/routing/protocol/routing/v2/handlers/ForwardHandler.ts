import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { MessageSender } from '../../../../../../agent/MessageSender'
import type { V2RoutingService } from '../V2RoutingService'

import { ForwardMessage } from '../messages'

export class ForwardHandler implements Handler {
  private routingService: V2RoutingService
  private messageSender: MessageSender

  public supportedMessages = [ForwardMessage]

  public constructor(routingService: V2RoutingService, messageSender: MessageSender) {
    this.routingService = routingService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<ForwardHandler>) {
    const { attachments } = await this.routingService.processForwardMessage(messageContext)

    const recipient = messageContext.message.firstRecipient
    if (!recipient) return

    for (const attachment of attachments) {
      await this.messageSender.sendEncryptedPackage(
        messageContext.agentContext,
        attachment.getDataAsJson(),
        recipient,
        messageContext.message.body.next
      )
    }
  }
}
