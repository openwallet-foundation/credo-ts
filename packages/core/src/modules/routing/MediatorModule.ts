import type { DependencyManager } from '../../plugins'
import type { EncryptedMessage } from '../../types'
import type { MediationRecord } from './repository'

import { AgentContext } from '../../agent'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { injectable, module } from '../../plugins'
import { ConnectionService } from '../connections/services'

import { KeylistUpdateHandler, ForwardHandler } from './handlers'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { MessagePickupService, V2MessagePickupService } from './protocol'
import { MediatorService } from './services/MediatorService'

@module()
@injectable()
export class MediatorModule {
  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  public eventEmitter: EventEmitter
  public agentContext: AgentContext
  public connectionService: ConnectionService

  public constructor(
    dispatcher: Dispatcher,
    mediationService: MediatorService,
    messagePickupService: MessagePickupService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    agentContext: AgentContext,
    connectionService: ConnectionService
  ) {
    this.mediatorService = mediationService
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.connectionService = connectionService
    this.agentContext = agentContext
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
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService))
  }

  /**
   * Registers the dependencies of the mediator module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(MediatorModule)

    // Services
    dependencyManager.registerSingleton(MediatorService)
    dependencyManager.registerSingleton(MessagePickupService)
    dependencyManager.registerSingleton(V2MessagePickupService)

    // FIXME: Inject in constructor
    dependencyManager.resolve(V2MessagePickupService)
  }
}
