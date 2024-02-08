import type { MessageHandler, MessageHandlerInboundMessage } from '../../../agent/MessageHandler'
import type { DRPCMessageService } from '../services/DRPCMessageService'

import { DRPCRequestMessage, DRPCResponseMessage } from '../messages'

export class DRPCMessageHandler implements MessageHandler {
  private drpcMessageService: DRPCMessageService
  public supportedMessages = [DRPCRequestMessage, DRPCResponseMessage]

  public constructor(drpcMessageService: DRPCMessageService) {
    this.drpcMessageService = drpcMessageService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<DRPCMessageHandler>) {
    console.log('Received DRPC message', messageContext.message)
    const connection = messageContext.assertReadyConnection()
    await this.drpcMessageService.save(messageContext, connection)
  }
}
