import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ValueTransferService } from '../services'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { CashAcceptedWitnessedMessage } from '../messages'

export class CashAcceptedWitnessedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferGiverService: ValueTransferGiverService

  public readonly supportedMessages = [CashAcceptedWitnessedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferGiverService: ValueTransferGiverService
  ) {
    this.agentConfig = agentConfig
    this.valueTransferService = valueTransferService
    this.valueTransferGiverService = valueTransferGiverService
  }

  public async handle(messageContext: HandlerV2InboundMessage<CashAcceptedWitnessedHandler>) {
    const { record } = await this.valueTransferGiverService.processCashAcceptanceWitnessed(messageContext)
    const { message } = await this.valueTransferGiverService.removeCash(record)
    return this.valueTransferService.sendMessageToWitness(message, record)
  }
}
