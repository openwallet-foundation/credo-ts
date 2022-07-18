import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { MediatorService } from '../services/MediatorService'
import type { MessageSender } from '@aries-framework/core'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { MediationRequestMessageV2 } from '../messages/MediationRequestMessage'

export class MediationRequestHandler implements Handler<typeof DIDCommV2Message> {
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
      const outboundMessage = createOutboundDIDCommV2Message(message)
      await this.messageSender.sendDIDCommV2Message(outboundMessage)
    }
  }
}
