import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { createOutboundMessage } from '../../../agent/helpers'
import { RequestWitnessedMessage } from '../messages/RequestWitnessedMessage'

export class RequestWitnessedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferGiverService: ValueTransferGiverService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator

  public readonly supportedMessages = [RequestWitnessedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferGiverService: ValueTransferGiverService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  ) {
    this.agentConfig = agentConfig
    this.valueTransferGiverService = valueTransferGiverService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestWitnessedHandler>) {
    const { record, forward } = await this.valueTransferGiverService.processRequestWitnessed(messageContext)

    if (this.valueTransferResponseCoordinator.shouldAutoRespondToRequest(record)) {
      const { message } = await this.valueTransferGiverService.acceptRequest(forward.witnessConnection, record)
      return createOutboundMessage(forward.witnessConnection, message)
    }
  }
}
