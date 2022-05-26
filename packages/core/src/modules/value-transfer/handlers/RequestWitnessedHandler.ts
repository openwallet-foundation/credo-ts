import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { ProblemReportMessage } from '../../problem-reports'
import { RequestWitnessedMessage } from '../messages/RequestWitnessedMessage'

export class RequestWitnessedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferGiverService: ValueTransferGiverService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  private messageSender: MessageSender

  public readonly supportedMessages = [RequestWitnessedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferGiverService: ValueTransferGiverService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.valueTransferGiverService = valueTransferGiverService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestWitnessedHandler>) {
    const { record, message } = await this.valueTransferGiverService.processRequestWitnessed(messageContext)
    if (!record || message.type === ProblemReportMessage.type) {
      return this.sendResponse(message)
    }

    if (this.valueTransferResponseCoordinator.shouldAutoRespondToRequest(record)) {
      const { message } = await this.valueTransferGiverService.acceptRequest(record)
      return this.sendResponse(message)
    }
  }

  private async sendResponse(message: DIDCommV2Message) {
    const outboundMessage = createOutboundDIDCommV2Message(message)
    const transport = this.agentConfig.valueTransferConfig?.witnessTransport
    await this.messageSender.sendDIDCommV2Message(outboundMessage, transport)
  }
}
