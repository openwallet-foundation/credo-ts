import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { CashAcceptedMessage, ProblemReportMessage } from '../messages'

export class CashAcceptedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [CashAcceptedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.agentConfig = agentConfig
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerV2InboundMessage<CashAcceptedHandler>) {
    const { record, message } = await this.valueTransferWitnessService.processCashAcceptance(messageContext)

    // if message is Problem Report -> also send it to Giver as well
    if (message.type === ProblemReportMessage.type) {
      await Promise.all([
        this.valueTransferService.sendMessageToGetter(message, record),
        this.valueTransferService.sendMessageToGiver(message, record),
      ])
      return
    }

    // send success message to Giver
    await this.valueTransferService.sendMessageToGiver(message, record)
  }
}
