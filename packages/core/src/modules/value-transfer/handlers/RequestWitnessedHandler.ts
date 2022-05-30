import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { ProblemReportMessage } from '../../problem-reports'
import { RequestWitnessedMessage } from '../messages/RequestWitnessedMessage'

export class RequestWitnessedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferGiverService: ValueTransferGiverService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator

  public readonly supportedMessages = [RequestWitnessedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferGiverService: ValueTransferGiverService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  ) {
    this.agentConfig = agentConfig
    this.valueTransferService = valueTransferService
    this.valueTransferGiverService = valueTransferGiverService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestWitnessedHandler>) {
    const { record, message } = await this.valueTransferGiverService.processRequestWitnessed(messageContext)
    if (!record || message.type === ProblemReportMessage.type) {
      return this.valueTransferService.sendMessageToWitness(message, record)
    }

    if (this.valueTransferResponseCoordinator.shouldAutoRespondToRequest(record)) {
      const { message } = await this.valueTransferGiverService.acceptRequest(record)
      return this.valueTransferService.sendMessageToWitness(message, record)
    }
  }
}
