import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ConnectionService } from '../../connections'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { ValueTransferRole } from '../ValueTransferRole'
import { CashAcceptedMessage } from '../messages'

export class CashAcceptedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  private connectionService: ConnectionService
  public readonly supportedMessages = [CashAcceptedMessage]

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

  public async handle(messageContext: HandlerV2InboundMessage<CashAcceptedHandler>) {
    const { record, message } = await this.valueTransferService.processCashAcceptance(messageContext)

    if (record.role === ValueTransferRole.Witness) {
      if (!record.giverConnectionId) {
        this.agentConfig.logger.error(`Connection to Giver not found for value transfer protocol: ${record.id}.`)
        return
      }
      const connection = await this.connectionService.getById(record.giverConnectionId)
      return createOutboundMessage(connection, message)
    }

    if (record.role === ValueTransferRole.Giver) {
      if (!record.witnessConnectionId) {
        this.agentConfig.logger.error(`Connection to Witness not found for value transfer protocol: ${record.id}.`)
        return
      }
      const connection = await this.connectionService.getById(record.witnessConnectionId)
      const { message } = await this.valueTransferService.removeCash(connection, record)
      return createOutboundMessage(connection, message)
    }
  }
}
