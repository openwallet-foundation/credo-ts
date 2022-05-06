import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2InboundMessage, HandlerV2 } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { ConnectionService } from '../../connections'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { CashRemovedMessage } from '../messages'

export class CashRemovedHandler implements HandlerV2 {
  private agentConfig: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  private connectionService: ConnectionService
  private messageSender: MessageSender
  public readonly supportedMessages = [CashRemovedMessage]

  public constructor(
    agentConfig: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator,
    connectionService: ConnectionService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.valueTransferService = valueTransferService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
    this.connectionService = connectionService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerV2InboundMessage<CashRemovedHandler>) {
    const { record } = await this.valueTransferService.processCashRemoved(messageContext)

    if (!record.giverConnectionId || !record.getterConnectionId) {
      throw new AriesFrameworkError(`Connection not found for ID: ${record.giverConnectionId}`)
    }
    const giverConnection = await this.connectionService.findById(record.giverConnectionId)
    if (!giverConnection || !giverConnection.theirDid) {
      throw new AriesFrameworkError(`Connection not found for ID: ${record.giverConnectionId}`)
    }
    const getterConnection = await this.connectionService.findById(record.getterConnectionId)
    if (!getterConnection || !getterConnection.theirDid) {
      throw new AriesFrameworkError(`Connection not found for ID: ${record.getterConnectionId}`)
    }

    const { getterMessage, giverMessage } = await this.valueTransferService.createReceipt(
      record,
      getterConnection,
      giverConnection
    )

    const getterOutboundMessage = createOutboundMessage(getterConnection, getterMessage)
    const giverOutboundMessage = createOutboundMessage(giverConnection, giverMessage)

    await this.messageSender.sendMessage(getterOutboundMessage)
    await this.messageSender.sendMessage(giverOutboundMessage)
    return
  }
}
