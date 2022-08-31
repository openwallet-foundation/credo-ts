import type { EncryptedMessage } from '../../types'
import type { MediationRecord } from './repository'

import { AgentContext } from '../../agent'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { injectable } from '../../plugins'
import { ConnectionService } from '../connections/services'

import { MediatorModuleConfig } from './MediatorModuleConfig'
import { ForwardHandler, KeylistUpdateHandler } from './handlers'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { MessagePickupService, V2MessagePickupService } from './protocol'
import { BatchHandler, BatchPickupHandler } from './protocol/pickup/v1/handlers'
import { MediatorService } from './services/MediatorService'

@injectable()
export class MediatorApi {
  public config: MediatorModuleConfig

  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private agentContext: AgentContext
  private connectionService: ConnectionService

  public constructor(
    dispatcher: Dispatcher,
    mediationService: MediatorService,
    messagePickupService: MessagePickupService,
    // Only imported so it is injected and handlers are registered
    v2MessagePickupService: V2MessagePickupService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    agentContext: AgentContext,
    connectionService: ConnectionService,
    config: MediatorModuleConfig
  ) {
    this.mediatorService = mediationService
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.config = config
    this.registerHandlers(dispatcher)
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
    const outboundMessage = createOutboundMessage(connectionRecord, message)

    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return mediationRecord
  }

  public queueMessage(connectionId: string, message: EncryptedMessage) {
    return this.messagePickupService.queueMessage(connectionId, message)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.mediatorService))
    dispatcher.registerHandler(new ForwardHandler(this.mediatorService, this.connectionService, this.messageSender))
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService, this.config))
  }
}
