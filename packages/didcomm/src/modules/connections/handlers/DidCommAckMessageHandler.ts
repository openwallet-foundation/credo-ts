import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommConnectionService } from '../services'

import { DidCommAckMessage } from '../../../messages'

export class DidCommAckMessageHandler implements DidCommMessageHandler {
  private connectionService: DidCommConnectionService
  public supportedMessages = [DidCommAckMessage]

  public constructor(connectionService: DidCommConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidCommAckMessageHandler>) {
    await this.connectionService.processAck(inboundMessage)

    return undefined
  }
}
