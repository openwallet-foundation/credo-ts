import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DrpcResponseMessage } from '../messages'
import type { DrpcService } from '../services/DrpcService'

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
