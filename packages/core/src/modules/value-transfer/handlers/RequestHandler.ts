import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { RequestMessage } from '../messages'

export class RequestHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferWitnessService: ValueTransferWitnessService
  private messageSender: MessageSender

  public readonly supportedMessages = [RequestMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferWitnessService: ValueTransferWitnessService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.messageSender = messageSender
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestHandler>) {
    const { message } = await this.valueTransferWitnessService.processRequest(messageContext)
    return this.sendResponse(message)
  }

  private async sendResponse(message: DIDCommV2Message) {
    const outboundMessage = createOutboundDIDCommV2Message(message)
    const transport = this.agentConfig.valueTransferConfig?.giverTransport
    await this.messageSender.sendDIDCommV2Message(outboundMessage, transport)
  }
}
