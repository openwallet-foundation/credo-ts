import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DrpcRequestMessage } from '../messages'
import type { DrpcService } from '../services/DrpcService'

export class DrpcRequestHandler implements DidCommMessageHandler {
  private drpcMessageService: DrpcService
  public supportedMessages = [DrpcRequestMessage]

  public constructor(drpcMessageService: DrpcService) {
    this.drpcMessageService = drpcMessageService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DrpcRequestHandler>) {
    await this.drpcMessageService.receiveRequest(messageContext)

    return undefined
  }
}
