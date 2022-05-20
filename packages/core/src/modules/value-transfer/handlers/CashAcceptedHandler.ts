import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'
import type { MessageSender } from '@aries-framework/core'

import { createOutboundMessage } from '../../../agent/helpers'
import { CashAcceptedMessage, ProblemReportMessage } from '../messages'

export class CashAcceptedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferWitnessService: ValueTransferWitnessService
  private messageSender: MessageSender
  public readonly supportedMessages = [CashAcceptedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferWitnessService: ValueTransferWitnessService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.valueTransferWitnessService = valueTransferWitnessService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerV2InboundMessage<CashAcceptedHandler>) {
    const { message, forward } = await this.valueTransferWitnessService.processCashAcceptance(messageContext)

    // send message to Giver
    const giverOutboundMessage = createOutboundMessage(forward.giverConnection, message)
    await this.messageSender.sendMessage(giverOutboundMessage)

    // if message is Problem Report -> also send it to Getter
    if (message.type === ProblemReportMessage.type) {
      const getterOutboundMessage = createOutboundMessage(forward.getterConnection, message)
      await this.messageSender.sendMessage(getterOutboundMessage)
    }
  }
}
