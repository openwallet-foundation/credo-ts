import type { Handler } from '../../../../../../agent/Handler'
import type { MessageSender } from '../../../../../../agent/MessageSender'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { V3MessagePickupService } from '../V3MessagePickupService'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { StatusRequestMessage } from '../messages'

export class StatusRequestHandler implements Handler {
  public supportedMessages = [StatusRequestMessage]
  private messageSender: MessageSender
  private messagePickupService: V3MessagePickupService

  public constructor(messagePickupService: V3MessagePickupService, messageSender: MessageSender) {
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
  }

  public async handle(messageContext: InboundMessageContext<StatusRequestMessage>) {
    messageContext.assertReadyConnection()
    const responseMessage = await this.messagePickupService.processStatusRequest(messageContext)
    if (responseMessage) {
      return new OutboundMessageContext(responseMessage, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
      })
    }
  }
}
