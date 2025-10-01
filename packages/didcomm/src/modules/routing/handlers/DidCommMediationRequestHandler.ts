import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediatorModuleConfig } from '../DidCommMediatorModuleConfig'
import type { DidCommMediatorService } from '../services/DidCommMediatorService'

import { DidCommOutboundMessageContext } from '../../../models'
import { DidCommMediationRequestMessage } from '../messages/DidCommMediationRequestMessage'

export class DidCommMediationRequestHandler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  private mediatorModuleConfig: DidCommMediatorModuleConfig
  public supportedMessages = [DidCommMediationRequestMessage]

  public constructor(mediatorService: DidCommMediatorService, mediatorModuleConfig: DidCommMediatorModuleConfig) {
    this.mediatorService = mediatorService
    this.mediatorModuleConfig = mediatorModuleConfig
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMediationRequestHandler>) {
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = await this.mediatorService.processMediationRequest(messageContext)

    if (this.mediatorModuleConfig.autoAcceptMediationRequests) {
      const { message } = await this.mediatorService.createGrantMediationMessage(
        messageContext.agentContext,
        mediationRecord
      )
      return new DidCommOutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection,
        associatedRecord: mediationRecord,
      })
    }
  }
}
