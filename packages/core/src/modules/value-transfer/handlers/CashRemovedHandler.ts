import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'
import type { Transport } from '@aries-framework/core'

import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
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
    const { record, message } = await this.valueTransferWitnessService.processCashRemoved(messageContext)

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

    const { getterReceiptMessage, giverReceiptMessage } = await this.valueTransferWitnessService.createReceipt(record)

    // send to giver
    await this.sendResponse(giverReceiptMessage, giverTransport)

    // send to getter
    await this.sendResponse(getterReceiptMessage, getterTransport)
    return
  }

  private async sendResponse(message: DIDCommV2Message, transport?: Transport) {
    const outboundMessage = createOutboundDIDCommV2Message(message)
    await this.messageSender.sendDIDCommV2Message(outboundMessage, transport)
  }
}
