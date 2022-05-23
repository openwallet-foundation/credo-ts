import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { createOutboundMessage } from '../../../agent/helpers'
import { ProblemReportMessage, RequestAcceptedMessage } from '../messages'

export class RequestAcceptedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferWitnessService: ValueTransferWitnessService
  private messageSender: MessageSender
  public readonly supportedMessages = [RequestAcceptedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferWitnessService: ValueTransferWitnessService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.valueTransferWitnessService = valueTransferWitnessService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestAcceptedHandler>) {
    const { message, forward } = await this.valueTransferWitnessService.processRequestAcceptance(messageContext)

    // send message to Getter
    const getterOutboundMessage = createOutboundMessage(forward.getterConnection, message)
    await this.messageSender.sendMessage(getterOutboundMessage)

    // if message is Problem Report -> also send it to Giver as well
    if (message.type === ProblemReportMessage.type) {
      const giverOutboundMessage = createOutboundMessage(forward.giverConnection, message)
      await this.messageSender.sendMessage(giverOutboundMessage)
    }
  }
}
