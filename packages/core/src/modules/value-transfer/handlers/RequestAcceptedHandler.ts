import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { Transport } from '../../routing/types'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
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
    const { message } = await this.valueTransferWitnessService.processRequestAcceptance(messageContext)

    const giverTransport = this.agentConfig.valueTransferConfig?.giverTransport
    const getterTransport = this.agentConfig.valueTransferConfig?.getterTransport

    // if message is Problem Report -> also send it to Giver as well
    if (message.type === ProblemReportMessage.type) {
      // send to giver
      message.to = [messageContext.message.body.payment.giver]
      await this.sendResponse(message, giverTransport)

      // send to getter
      message.to = [messageContext.message.body.payment.getter]
      await this.sendResponse(message, getterTransport)

      return
    }

    // send success message to Getter
    await this.sendResponse(message, getterTransport)
  }

  private async sendResponse(message: DIDCommV2Message, transport?: Transport) {
    const outboundMessage = createOutboundDIDCommV2Message(message)
    await this.messageSender.sendDIDCommV2Message(outboundMessage, transport)
  }
}
