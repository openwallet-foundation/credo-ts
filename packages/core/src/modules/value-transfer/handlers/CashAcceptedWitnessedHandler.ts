import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { createOutboundMessage } from '../../../agent/helpers'
import { CashAcceptedWitnessedMessage } from '../messages'

export class CashAcceptedWitnessedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferGiverService: ValueTransferGiverService
  public readonly supportedMessages = [CashAcceptedWitnessedMessage]

  public constructor(agentConfig: AgentConfig, valueTransferGiverService: ValueTransferGiverService) {
    this.agentConfig = agentConfig
    this.valueTransferGiverService = valueTransferGiverService
  }

  public async handle(messageContext: HandlerV2InboundMessage<CashAcceptedWitnessedHandler>) {
    const { record, forward } = await this.valueTransferGiverService.processCashAcceptanceWitnessed(messageContext)
    const { message } = await this.valueTransferGiverService.removeCash(forward.witnessConnection, record)
    return createOutboundMessage(forward.witnessConnection, message)
  }
}
