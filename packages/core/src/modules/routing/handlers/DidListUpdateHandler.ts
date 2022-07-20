import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { MediatorService } from '../services/MediatorService'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { DidListUpdateMessage } from '../messages'

export class DidListUpdateHandler implements Handler<typeof DIDCommV2Message> {
  private mediatorService: MediatorService
  private messageSender: MessageSender
  public supportedMessages = [DidListUpdateMessage]

  public constructor(mediatorService: MediatorService, messageSender: MessageSender) {
    this.mediatorService = mediatorService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<DidListUpdateHandler>) {
    const response = await this.mediatorService.processDidListUpdateRequest(messageContext)
    if (!response) return
    const outboundMessage = createOutboundDIDCommV2Message(response)
    await this.messageSender.sendDIDCommV2Message(outboundMessage)
  }
}
