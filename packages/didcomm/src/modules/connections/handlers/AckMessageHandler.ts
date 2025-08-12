import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { ConnectionService } from '../services'

import { AckDidCommMessage } from '../../../messages'

export class AckMessageHandler implements DidCommMessageHandler {
  private connectionService: ConnectionService
  public supportedMessages = [AckDidCommMessage]

  public constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<AckMessageHandler>) {
    await this.connectionService.processAck(inboundMessage)

    return undefined
  }
}
