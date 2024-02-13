import type { DrpcService } from '../services/DrpcService'
import type { MessageHandler, MessageHandlerInboundMessage } from '@credo-ts/core'

import { DrpcRequestMessage, DrpcResponseMessage } from '../messages'

export class DrpcHandler implements MessageHandler {
  private drpcMessageService: DrpcService
  public supportedMessages = [DrpcRequestMessage, DrpcResponseMessage]

  public constructor(drpcMessageService: DrpcService) {
    this.drpcMessageService = drpcMessageService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<DrpcHandler>) {
    const connection = messageContext.assertReadyConnection()
    await this.drpcMessageService.save(messageContext, connection)
  }
}
