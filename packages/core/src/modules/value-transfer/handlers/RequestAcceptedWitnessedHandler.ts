import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { ValueTransferGetterService } from '../services/ValueTransferGetterService'

import { createOutboundMessage } from '../../../agent/helpers'
import { RequestAcceptedWitnessedMessage } from '../messages'

export class RequestAcceptedWitnessedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferGetterService: ValueTransferGetterService
  public readonly supportedMessages = [RequestAcceptedWitnessedMessage]

  public constructor(agentConfig: AgentConfig, valueTransferGetterService: ValueTransferGetterService) {
    this.agentConfig = agentConfig
    this.valueTransferGetterService = valueTransferGetterService
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestAcceptedWitnessedHandler>) {
    const { record, forward } = await this.valueTransferGetterService.processRequestAcceptanceWitnessed(messageContext)
    const { message } = await this.valueTransferGetterService.acceptCash(forward.witnessConnection, record)
    return createOutboundMessage(forward.witnessConnection, message)
  }
}
