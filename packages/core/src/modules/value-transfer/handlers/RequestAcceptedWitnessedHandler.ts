import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferGetterService } from '../services/ValueTransferGetterService'

import { RequestAcceptedWitnessedMessage } from '../messages'

export class RequestAcceptedWitnessedHandler implements Handler<typeof DIDCommV2Message> {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferGetterService: ValueTransferGetterService

  public readonly supportedMessages = [RequestAcceptedWitnessedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferGetterService: ValueTransferGetterService
  ) {
    this.agentConfig = agentConfig
    this.valueTransferService = valueTransferService
    this.valueTransferGetterService = valueTransferGetterService
  }

  public async handle(messageContext: HandlerInboundMessage<RequestAcceptedWitnessedHandler>) {
    const { record } = await this.valueTransferGetterService.processRequestAcceptanceWitnessed(messageContext)
    const { message } = await this.valueTransferGetterService.acceptCash(record)
    return this.valueTransferService.sendMessageToWitness(message)
  }
}
