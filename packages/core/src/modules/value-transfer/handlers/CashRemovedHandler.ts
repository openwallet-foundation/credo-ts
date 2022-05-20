import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { createOutboundMessage } from '../../../agent/helpers'
import { CashRemovedMessage, ProblemReportMessage } from '../messages'

export class CashRemovedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferWitnessService: ValueTransferWitnessService
  private messageSender: MessageSender
  public readonly supportedMessages = [CashRemovedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferWitnessService: ValueTransferWitnessService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.valueTransferWitnessService = valueTransferWitnessService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerV2InboundMessage<CashRemovedHandler>) {
    const { record, message, forward } = await this.valueTransferWitnessService.processCashRemoved(messageContext)

    if (message.type === ProblemReportMessage.type) {
      const getterOutboundMessage = createOutboundMessage(forward.getterConnection, message)
      const giverOutboundMessage = createOutboundMessage(forward.giverConnection, message)

      await this.messageSender.sendMessage(getterOutboundMessage)
      await this.messageSender.sendMessage(giverOutboundMessage)
      return
    }

    const { getterReceiptMessage, giverReceiptMessage } = await this.valueTransferWitnessService.createReceipt(
      record,
      forward.getterConnection,
      forward.giverConnection
    )

    const getterOutboundMessage = createOutboundMessage(forward.getterConnection, getterReceiptMessage)
    const giverOutboundMessage = createOutboundMessage(forward.giverConnection, giverReceiptMessage)

    await this.messageSender.sendMessage(getterOutboundMessage)
    await this.messageSender.sendMessage(giverOutboundMessage)
    return
  }
}
