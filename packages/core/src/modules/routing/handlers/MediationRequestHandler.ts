import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediatorModuleConfig } from '../MediatorModuleConfig'
import type { MediatorService } from '../services/MediatorService'

import { OutboundMessageContext } from '../../../agent/models'
import { MediationRequestMessage } from '../messages/MediationRequestMessage'

export class MediationRequestHandler implements Handler {
  private mediatorService: MediatorService
  private mediatorModuleConfig: MediatorModuleConfig
  public supportedMessages = [MediationRequestMessage]

  public constructor(mediatorService: MediatorService, mediatorModuleConfig: MediatorModuleConfig) {
    this.mediatorService = mediatorService
    this.mediatorModuleConfig = mediatorModuleConfig
  }

  public async handle(messageContext: HandlerInboundMessage<MediationRequestHandler>) {
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = await this.mediatorService.processMediationRequest(messageContext)

    if (this.mediatorModuleConfig.autoAcceptMediationRequests) {
      const { message } = await this.mediatorService.createGrantMediationMessage(
        messageContext.agentContext,
        mediationRecord
      )
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection,
        associatedRecord: mediationRecord,
      })
    }
  }
}
