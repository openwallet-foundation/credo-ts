import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { createOutboundMessage } from '../../../agent/helpers'
import { RequestMessage } from '../messages'

export class RequestHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [RequestMessage]

  public constructor(agentConfig: AgentConfig, valueTransferWitnessService: ValueTransferWitnessService) {
    this.agentConfig = agentConfig
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestHandler>) {
    const { message, forward } = await this.valueTransferWitnessService.processRequest(messageContext)
    return createOutboundMessage(forward, message)
  }
}
