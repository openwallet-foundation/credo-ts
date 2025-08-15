import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediatorModuleConfig } from '../DidCommMediatorModuleConfig'
import type { DidCommMediatorService } from '../services/DidCommMediatorService'

import { OutboundDidCommMessageContext } from '../../../models'
import { MediationRequestMessage } from '../messages/MediationRequestMessage'

export class MediationRequestHandler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  private mediatorModuleConfig: DidCommMediatorModuleConfig
  public supportedMessages = [MediationRequestMessage]

  public constructor(mediatorService: DidCommMediatorService, mediatorModuleConfig: DidCommMediatorModuleConfig) {
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
