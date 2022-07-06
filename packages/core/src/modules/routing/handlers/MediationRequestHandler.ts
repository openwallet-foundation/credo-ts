import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediatorService } from '../services/MediatorService'

import { createOutboundMessage } from '../../../agent/helpers'
import { MediationRequestMessage } from '../messages/MediationRequestMessage'

export class MediationRequestHandler implements Handler {
  private mediatorService: MediatorService
  public supportedMessages = [MediationRequestMessage]

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationRequestHandler>) {
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = await this.mediatorService.processMediationRequest(messageContext)

    if (messageContext.agentContext.config.autoAcceptMediationRequests) {
      const { message } = await this.mediatorService.createGrantMediationMessage(
        messageContext.agentContext,
        mediationRecord
      )
      return createOutboundMessage(connection, message)
    }
  }
}
