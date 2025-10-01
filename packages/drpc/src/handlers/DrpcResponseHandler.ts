import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { DrpcService } from '../services/DrpcService'

import { DrpcResponseMessage } from '../messages'

export class DrpcResponseHandler implements DidCommMessageHandler {
  private drpcMessageService: DrpcService
  public supportedMessages = [DrpcResponseMessage]

  public constructor(drpcMessageService: DrpcService) {
    this.drpcMessageService = drpcMessageService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DrpcResponseHandler>) {
    await this.drpcMessageService.receiveResponse(messageContext)

    return undefined
  }
}
