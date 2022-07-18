import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { MessagePickupService } from '../services'
import type { MessageSender } from '@aries-framework/core'

import { BatchPickupMessageV2 } from '../messages'

export class BatchPickupHandler implements Handler<typeof DIDCommV2Message> {
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  public supportedMessages = [BatchPickupMessageV2]

  public constructor(messagePickupService: MessagePickupService, messageSender: MessageSender) {
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<BatchPickupHandler>) {
    const message = await this.messagePickupService.batch(messageContext)
    if (message) {
      await this.messageSender.sendDIDCommV2Message(message)
    }
  }
}
