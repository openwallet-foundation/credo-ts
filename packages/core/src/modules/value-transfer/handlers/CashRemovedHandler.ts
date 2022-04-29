import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { ConnectionService } from '../../connections'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { CashRemovedMessage } from '../messages'

export class CashRemovedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  private connectionService: ConnectionService
  public readonly supportedMessages = [CashRemovedMessage]

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

  public async handle(messageContext: HandlerV2InboundMessage<CashRemovedHandler>) {
    const { record: recordTemp } = await this.valueTransferService.processCashRemoved(messageContext)
    const { record } = await this.valueTransferService.createReceipt(recordTemp)
    if (!record.getterConnectionId) {
      this.agentConfig.logger.error(`Connection to Witness not found for value transfer protocol: ${record.id}.`)
      return
    }
    if (!record.giverConnectionId) {
      this.agentConfig.logger.error(`Connection to Witness not found for value transfer protocol: ${record.id}.`)
      return
    }
    const getterConnection = await this.connectionService.getById(record.getterConnectionId)
    const giverConnection = await this.connectionService.getById(record.giverConnectionId)
    if (!record.receiptMessage) {
      this.agentConfig.logger.error(`Receipt not found for value transfer protocol: ${record.id}.`)
      return
    }
    return createOutboundMessage(getterConnection, record.receiptMessage) // TODO: Send to both connections
  }
}
