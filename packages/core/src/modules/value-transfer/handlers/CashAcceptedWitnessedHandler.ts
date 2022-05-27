import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { CashAcceptedWitnessedMessage } from '../messages'

export class CashAcceptedWitnessedHandler implements Handler<typeof DIDCommV2Message> {
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

  public async handle(messageContext: HandlerInboundMessage<CashAcceptedWitnessedHandler>) {
    const { record } = await this.valueTransferGiverService.processCashAcceptanceWitnessed(messageContext)
    const { message } = await this.valueTransferGiverService.removeCash(record)
    return this.valueTransferService.sendMessageToWitness(message)
  }
}
