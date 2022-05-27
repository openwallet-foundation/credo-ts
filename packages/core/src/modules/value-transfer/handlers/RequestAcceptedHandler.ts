import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { ProblemReportMessage, RequestAcceptedMessage } from '../messages'

export class RequestAcceptedHandler implements Handler<typeof DIDCommV2Message> {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [RequestAcceptedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.agentConfig = agentConfig
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<RequestAcceptedHandler>) {
    const { message } = await this.valueTransferWitnessService.processRequestAcceptance(messageContext)

    // if message is Problem Report -> also send it to Giver as well
    if (message.type === ProblemReportMessage.type) {
      await Promise.all([
        this.valueTransferService.sendMessageToGetter(message),
        this.valueTransferService.sendMessageToGiver(message),
      ])
      return
    }

    // send success message to Getter
    await this.valueTransferService.sendMessageToGetter(message)
  }
}
