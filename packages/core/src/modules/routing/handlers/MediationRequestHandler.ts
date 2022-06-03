import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV1Message } from '../../../agent/didcomm'
import type { MediatorService } from '../services/MediatorService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { MediationRequestMessage } from '../messages/MediationRequestMessage'

export class MediationRequestHandler implements Handler<typeof DIDCommV1Message> {
  private mediatorService: MediatorService
  private agentConfig: AgentConfig
  public supportedMessages = [MediationRequestMessage]

  public constructor(mediatorService: MediatorService, agentConfig: AgentConfig) {
    this.mediatorService = mediatorService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<MediationRequestHandler>) {
    if (!messageContext.connection) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipient} not found!`)
    }

    const mediationRecord = await this.mediatorService.processMediationRequest(messageContext)

    if (this.agentConfig.autoAcceptMediationRequests) {
      const { message } = await this.mediatorService.createGrantMediationMessage(mediationRecord)
      return createOutboundMessage(messageContext.connection, message)
    }
  }
}
