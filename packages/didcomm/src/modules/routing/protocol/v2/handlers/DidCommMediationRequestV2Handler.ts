import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../../models'
import type { DidCommMediatorModuleConfig } from '../../../DidCommMediatorModuleConfig'
import type { DidCommMediatorService } from '../../../services/DidCommMediatorService'
import { DidCommMediateRequestV2Message } from '../messages'

export class DidCommMediationRequestV2Handler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  private mediatorModuleConfig: DidCommMediatorModuleConfig
  public supportedMessages = [DidCommMediateRequestV2Message]

  public constructor(mediatorService: DidCommMediatorService, mediatorModuleConfig: DidCommMediatorModuleConfig) {
    this.mediatorService = mediatorService
    this.mediatorModuleConfig = mediatorModuleConfig
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMediationRequestV2Handler>) {
    const { mediationRecord, connection } = await this.mediatorService.processMediationRequestV2(messageContext)

    if (this.mediatorModuleConfig.autoAcceptMediationRequests) {
      const { message } = await this.mediatorService.createGrantMediationMessageV2(
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
