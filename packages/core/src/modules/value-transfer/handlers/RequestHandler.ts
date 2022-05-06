import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { ConnectionService } from '../../connections/services'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { ValueTransferRole } from '../ValueTransferRole'
import { RequestMessage } from '../messages'

export class RequestHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  private connectionService: ConnectionService

  public readonly supportedMessages = [RequestMessage]

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

  public async handle(messageContext: HandlerV2InboundMessage<RequestHandler>) {
    const { record, message } = await this.valueTransferService.processRequest(messageContext)
    if (record.role === ValueTransferRole.Witness) {
      if (!record.giverConnectionId) {
        this.agentConfig.logger.error(`Connection to Giver not found for value transfer protocol: ${record.id}.`)
        return
      }
      const connection = await this.connectionService.getById(record.giverConnectionId)
      return createOutboundMessage(connection, message)
    }

    if (
      record.role === ValueTransferRole.Giver &&
      this.valueTransferResponseCoordinator.shouldAutoRespondToRequest(record)
    ) {
      if (!record.witnessConnectionId) {
        this.agentConfig.logger.error(`Connection to Witness not found for value transfer protocol: ${record.id}.`)
        return
      }
      const connection = await this.connectionService.getById(record.witnessConnectionId)
      const { message } = await this.valueTransferService.acceptRequest(record)
      return createOutboundMessage(connection, message)
    }
  }
}
