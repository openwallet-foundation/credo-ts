import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommConnectionService } from '../services'

import { AckDidCommMessage } from '../../../messages'

export class AckMessageHandler implements DidCommMessageHandler {
  private connectionService: DidCommConnectionService
  public supportedMessages = [AckDidCommMessage]

  public constructor(connectionService: DidCommConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<AckMessageHandler>) {
    await this.connectionService.processAck(inboundMessage)

    return undefined
  }
}
