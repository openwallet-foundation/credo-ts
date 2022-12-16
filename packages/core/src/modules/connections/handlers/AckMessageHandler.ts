import type { MessageHandler, MessageHandlerInboundMessage } from '../../../agent/MessageHandler'
import type { ConnectionService } from '../services/ConnectionService'

import { AckMessage } from '../../common'

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
