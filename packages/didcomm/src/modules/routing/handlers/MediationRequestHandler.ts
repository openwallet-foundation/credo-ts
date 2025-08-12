import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { MediatorModuleConfig } from '../MediatorModuleConfig'
import type { MediatorService } from '../services/MediatorService'

import { OutboundDidCommMessageContext } from '../../../models'
import { MediationRequestMessage } from '../messages/MediationRequestMessage'

export class MediationRequestHandler implements DidCommMessageHandler {
  private mediatorService: MediatorService
  private mediatorModuleConfig: MediatorModuleConfig
  public supportedMessages = [MediationRequestMessage]

  public constructor(mediatorService: MediatorService, mediatorModuleConfig: MediatorModuleConfig) {
    this.mediatorService = mediatorService
    this.mediatorModuleConfig = mediatorModuleConfig
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MediationRequestHandler>) {
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = await this.mediatorService.processMediationRequest(messageContext)

    if (this.mediatorModuleConfig.autoAcceptMediationRequests) {
      const { message } = await this.mediatorService.createGrantMediationMessage(
        messageContext.agentContext,
        mediationRecord
      )
      return new OutboundDidCommMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection,
        associatedRecord: mediationRecord,
      })
    }
  }
}
