import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { ConnectionService } from '../../connections'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { ValueTransferRole } from '../ValueTransferRole'
import { RequestAcceptedMessage } from '../messages'

export class RequestAcceptedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  private connectionService: ConnectionService
  public readonly supportedMessages = [RequestAcceptedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator,
    connectionService: ConnectionService
  ) {
    this.agentConfig = agentConfig
    this.valueTransferService = valueTransferService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
    this.connectionService = connectionService
  }

  public async handle(messageContext: HandlerV2InboundMessage<RequestAcceptedHandler>) {
    const { record, message } = await this.valueTransferService.processRequestAcceptance(messageContext)
    if (record.role === ValueTransferRole.Witness) {
      if (!record.getterConnectionId) {
        this.agentConfig.logger.error(`Connection to Getter not found for value transfer protocol: ${record.id}.`)
        return
      }
      const connection = await this.connectionService.getById(record.getterConnectionId)
      return createOutboundMessage(connection, message)
    }

    if (record.role === ValueTransferRole.Getter) {
      if (!record.witnessConnectionId) {
        this.agentConfig.logger.error(`Connection to Witness not found for value transfer protocol: ${record.id}.`)
        return
      }
      const connection = await this.connectionService.getById(record.witnessConnectionId)
      const { message } = await this.valueTransferService.acceptCash(connection, record)
      return createOutboundMessage(connection, message)
    }
  }
}
