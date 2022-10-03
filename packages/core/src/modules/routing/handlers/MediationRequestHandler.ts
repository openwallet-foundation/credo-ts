import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { MediatorService } from '../services/MediatorService'

import { MediationRequestMessageV2 } from '../messages/MediationRequestMessage'

export class MediationRequestHandler implements Handler {
  private mediatorService: MediatorService
  private agentConfig: AgentConfig
  private messageSender: MessageSender
  public supportedMessages = [MediationRequestMessageV2]

  public constructor(mediatorService: MediatorService, agentConfig: AgentConfig, messageSender: MessageSender) {
    this.mediatorService = mediatorService
    this.agentConfig = agentConfig
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<MediationRequestHandler>) {
    const mediationRecord = await this.mediatorService.processMediationRequest(messageContext)
    if (!mediationRecord) return

    if (this.agentConfig.autoAcceptMediationRequests) {
      const { message } = await this.mediatorService.createGrantMediationMessage(mediationRecord)
      await this.messageSender.sendDIDCommV2Message(message)
    }
  }
}
