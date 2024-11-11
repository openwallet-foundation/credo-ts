import type { ConnectionService } from '../../services'
import type { MessageHandler, MessageHandlerInboundMessage } from '../MessageHandler'

import { AckMessage } from '../../messages'

export class AckMessageHandler implements MessageHandler {
  private connectionService: ConnectionService
  public supportedMessages = [AckMessage]

  public constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(inboundMessage: MessageHandlerInboundMessage<AckMessageHandler>) {
    await this.connectionService.processAck(inboundMessage)
  }
}
