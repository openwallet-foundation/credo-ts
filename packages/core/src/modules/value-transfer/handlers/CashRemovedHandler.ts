import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { CashRemovedMessage, ProblemReportMessage } from '../messages'

export class CashRemovedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [CashRemovedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.agentConfig = agentConfig
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerV2InboundMessage<CashRemovedHandler>) {
    const { record, message } = await this.valueTransferWitnessService.processCashRemoved(messageContext)

    // if message is Problem Report -> also send it to Giver as well
    if (message.type === ProblemReportMessage.type) {
      await Promise.all([
        this.valueTransferService.sendMessageToGetter(message, record),
        this.valueTransferService.sendMessageToGiver(message, record),
      ])
      return
    }

    const { getterReceiptMessage, giverReceiptMessage } = await this.valueTransferWitnessService.createReceipt(record)

    await Promise.all([
      this.valueTransferService.sendMessageToGetter(getterReceiptMessage, record),
      this.valueTransferService.sendMessageToGiver(giverReceiptMessage, record),
    ])
    return
  }
}
