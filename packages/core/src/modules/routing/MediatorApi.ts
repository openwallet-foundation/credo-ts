import type { EncryptedMessage } from '../../didcomm/types'
import type { MediationRecord } from './repository'

import { AgentContext } from '../../agent'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
import { injectable } from '../../plugins'
import { ConnectionService } from '../connections/services'

import { MediatorModuleConfig } from './MediatorModuleConfig'
import { MessagePickupService, V2MessagePickupService, V3MessagePickupService } from './protocol'
import { MediatorService, V2MediatorService } from './protocol/coordinate-mediation'
import { RoutingService, V2RoutingService } from './protocol/routing'

@injectable()
export class MediatorApi {
  public config: MediatorModuleConfig

  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  private agentContext: AgentContext
  private connectionService: ConnectionService

  public constructor(
    mediationService: MediatorService,
    v2MediatorService: V2MediatorService,
    messagePickupService: MessagePickupService,
    // Only imported so it is injected and handlers are registered
    v2MessagePickupService: V2MessagePickupService,
    v3MessagePickupService: V3MessagePickupService,
    routingService: RoutingService,
    v2RoutingService: V2RoutingService,
    messageSender: MessageSender,
    agentContext: AgentContext,
    connectionService: ConnectionService,
    config: MediatorModuleConfig
  ) {
    this.mediatorService = mediationService
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.config = config
  }

  public async initialize() {
    this.agentContext.config.logger.debug('Mediator routing record not loaded yet, retrieving from storage')
    const routingRecord = await this.mediatorService.findMediatorRoutingRecord(this.agentContext)

    // If we don't have a routing record yet for this tenant, create it
    if (!routingRecord) {
      this.agentContext.config.logger.debug(
        'Mediator routing record does not exist yet, creating routing keys and record'
      )
      await this.mediatorService.createMediatorRoutingRecord(this.agentContext)
    }
  }

  public async grantRequestedMediation(mediatorId: string): Promise<MediationRecord> {
    const record = await this.mediatorService.getById(this.agentContext, mediatorId)
    const connectionRecord = await this.connectionService.getById(this.agentContext, record.connectionId)

    const { message, mediationRecord } = await this.mediatorService.createGrantMediationMessage(
      this.agentContext,
      record
    )
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection: connectionRecord,
      associatedRecord: mediationRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)

    return mediationRecord
  }

  public queueMessage(connectionId: string, message: EncryptedMessage) {
    return this.messagePickupService.queueMessage(connectionId, message)
  }
}
