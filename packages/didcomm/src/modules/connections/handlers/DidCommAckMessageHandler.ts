import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommAckMessage } from '../../../messages'
import type { DidCommConnectionService } from '../services'

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
