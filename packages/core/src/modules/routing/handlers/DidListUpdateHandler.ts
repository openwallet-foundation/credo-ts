import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { MediatorService } from '../services/MediatorService'

import { V2KeyListUpdateMessage } from '../messages'

export class DidListUpdateHandler implements Handler {
  private mediatorService: MediatorService
  private messageSender: MessageSender
  public supportedMessages = [V2KeyListUpdateMessage]

  public constructor(mediatorService: MediatorService, messageSender: MessageSender) {
    this.mediatorService = mediatorService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<DidListUpdateHandler>) {
    const response = await this.mediatorService.processDidListUpdateRequest(messageContext)
    if (!response) return
    await this.messageSender.sendDIDCommV2Message(response)
  }
}
