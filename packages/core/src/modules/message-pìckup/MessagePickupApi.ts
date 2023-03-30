import type { EncryptedMessage } from '../../types'

import { AgentContext } from '../../agent'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
import { injectable } from '../../plugins'
import { ConnectionService } from '../connections/services'

import { MessagePickupModuleConfig } from './MessagePickupModuleConfig'
import { V1MessagePickupProtocol, V2MessagePickupProtocol } from './protocol'

@injectable()
export class MessagePickupApi {
  public config: MessagePickupModuleConfig

  private v1MessagePickupService: V1MessagePickupProtocol
  private v2MessagePickupService: V2MessagePickupProtocol
  private messageSender: MessageSender
  private agentContext: AgentContext
  private connectionService: ConnectionService

  public constructor(
    messagePickupService: V1MessagePickupProtocol,
    v2MessagePickupService: V2MessagePickupProtocol,
    messageSender: MessageSender,
    agentContext: AgentContext,
    connectionService: ConnectionService,
    config: MessagePickupModuleConfig
  ) {
    this.v1MessagePickupService = messagePickupService
    this.v2MessagePickupService = v2MessagePickupService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.config = config
  }

  public async queueMessage(connectionId: string, message: EncryptedMessage) {
    return this.v1MessagePickupService.queueMessage(connectionId, message)
  }

  public async pickupMessages(options: {
    connectionId: string
    recipientKey?: string
    protocolVersion?: 'v1' | 'v2'
    batchSize?: number
  }) {
    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)

    const pickupMessage =
      options.protocolVersion === 'v2'
        ? await this.v2MessagePickupService.createStatusRequest(connectionRecord, {
            recipientKey: options.recipientKey,
          })
        : await this.v1MessagePickupService.createBatchPickupMessage(connectionRecord, {
            batchSize: options.batchSize ?? this.config.maximumMessagePickup,
          })

    await this.messageSender.sendMessage(
      new OutboundMessageContext(pickupMessage, {
        agentContext: this.agentContext,
        connection: connectionRecord,
      })
    )
  }
}
