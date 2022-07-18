import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { MediatorService } from '../services/MediatorService'
import type { MessageSender } from '@aries-framework/core'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { KeylistUpdateMessageV2 } from '../messages'

export class KeylistUpdateHandler implements Handler<typeof DIDCommV2Message> {
  private mediatorService: MediatorService
  private messageSender: MessageSender
  public supportedMessages = [KeylistUpdateMessageV2]

  public constructor(mediatorService: MediatorService, messageSender: MessageSender) {
    this.mediatorService = mediatorService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateHandler>) {
    const response = await this.mediatorService.processKeylistUpdateRequest(messageContext)
    if (!response) return
    const outboundMessage = createOutboundDIDCommV2Message(response)
    await this.messageSender.sendDIDCommV2Message(outboundMessage)
  }
}
