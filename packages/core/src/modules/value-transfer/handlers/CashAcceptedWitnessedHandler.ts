import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { CashAcceptedWitnessedMessage } from '../messages'

export class CashAcceptedWitnessedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferGiverService: ValueTransferGiverService
  private messageSender: MessageSender

  public readonly supportedMessages = [CashAcceptedWitnessedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferGiverService: ValueTransferGiverService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.valueTransferGiverService = valueTransferGiverService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerV2InboundMessage<CashAcceptedWitnessedHandler>) {
    const { record } = await this.valueTransferGiverService.processCashAcceptanceWitnessed(messageContext)
    const { message } = await this.valueTransferGiverService.removeCash(record)
    return this.sendResponse(message)
  }

  private async sendResponse(message: DIDCommV2Message) {
    const outboundMessage = createOutboundDIDCommV2Message(message)
    const transport = this.agentConfig.valueTransferConfig?.witnessTransport
    await this.messageSender.sendDIDCommV2Message(outboundMessage, transport)
  }
}
