import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { OutOfBandService } from '../services'

import { OutOfBandInvitationMessage } from '../messages'

export class OutOfBandInvitationHandler implements Handler<typeof DIDCommV2Message> {
  private outOfBandService: OutOfBandService

  public readonly supportedMessages = [OutOfBandInvitationMessage]

  public constructor(outOfBandService: OutOfBandService) {
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: HandlerInboundMessage<OutOfBandInvitationHandler>) {
    await this.outOfBandService.receiveOutOfBandInvitation(messageContext.message)
  }
}
