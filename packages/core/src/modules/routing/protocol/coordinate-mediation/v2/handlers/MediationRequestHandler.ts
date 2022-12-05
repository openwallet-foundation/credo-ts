import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { MessageSender } from '../../../../../../agent/MessageSender'
import type { MediatorModuleConfig } from '../../../../MediatorModuleConfig'
import type { V2MediatorService } from '../V2MediatorService'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { MediationRequestMessage } from '../messages/MediationRequestMessage'

export class MediationRequestHandler implements Handler {
  private mediatorService: V2MediatorService
  private mediatorModuleConfig: MediatorModuleConfig
  private messageSender: MessageSender
  public supportedMessages = [MediationRequestMessage]

  public constructor(
    mediatorService: V2MediatorService,
    mediatorModuleConfig: MediatorModuleConfig,
    messageSender: MessageSender
  ) {
    this.mediatorService = mediatorService
    this.mediatorModuleConfig = mediatorModuleConfig
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<MediationRequestHandler>) {
    const mediationRecord = await this.mediatorService.processMediationRequest(messageContext)
    if (!mediationRecord) return

    if (this.mediatorModuleConfig.autoAcceptMediationRequests) {
      const { message } = await this.mediatorService.createGrantMediationMessage(
        messageContext.agentContext,
        mediationRecord
      )
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
      })
    }
  }
}
