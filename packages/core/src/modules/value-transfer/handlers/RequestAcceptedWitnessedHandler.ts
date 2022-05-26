import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferGetterService } from '../services/ValueTransferGetterService'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { RequestAcceptedWitnessedMessage } from '../messages'

export class RequestAcceptedWitnessedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferGetterService: ValueTransferGetterService
  private messageSender: MessageSender

  public readonly supportedMessages = [RequestAcceptedWitnessedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferGetterService: ValueTransferGetterService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.valueTransferGetterService = valueTransferGetterService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestAcceptedWitnessedHandler>) {
    const { record } = await this.valueTransferGetterService.processRequestAcceptanceWitnessed(messageContext)
    const { message } = await this.valueTransferGetterService.acceptCash(record)
    return this.sendResponse(message)
  }

  private async sendResponse(message: DIDCommV2Message) {
    const outboundMessage = createOutboundDIDCommV2Message(message)
    const transport = this.agentConfig.valueTransferConfig?.witnessTransport
    await this.messageSender.sendDIDCommV2Message(outboundMessage, transport)
  }
}
