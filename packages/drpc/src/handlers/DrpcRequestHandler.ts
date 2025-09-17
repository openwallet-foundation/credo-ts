import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { DrpcService } from '../services/DrpcService'

import { DrpcRequestMessage } from '../messages'

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
