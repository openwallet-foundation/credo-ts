import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { ProblemReportMessage, RequestMessage } from '../messages'

export class RequestHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [RequestMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.agentConfig = agentConfig
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestHandler>) {
    const { record, message } = await this.valueTransferWitnessService.processRequest(messageContext)
    if (message.type === ProblemReportMessage.type) {
      return this.valueTransferService.sendMessageToGetter(message, record)
    }
    return this.valueTransferService.sendMessageToGiver(message, record)
  }
}
