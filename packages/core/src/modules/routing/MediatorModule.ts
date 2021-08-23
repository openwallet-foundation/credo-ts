import type { WireMessage } from '../../types'
import type { MediationRecord } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ConnectionService } from '../connections/services'

import { KeylistUpdateHandler, ForwardHandler, BatchPickupHandler, BatchHandler } from './handlers'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { MediatorService } from './services/MediatorService'
import { MessagePickupService } from './services/MessagePickupService'

/**
 * class the represents mediation as a service.
 *
 * @remarks
 *
 * @example
 *
 * @returns
 *
 * @public
 */

@scoped(Lifecycle.ContainerScoped)
export class MediatorModule {
  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  public eventEmitter: EventEmitter
  public agentConfig: AgentConfig
  public connectionService: ConnectionService

  /**
   * creates an instance of mediatorModule
   *
   * @remarks
   *
   * @example
   *
   * @typeParam dispatcher -
   * @typeParam mediationService - mediation service
   * @typeParam messagePickupService - the message pickup service
   * @typeParam messageSender - the message sender
   * @typeParam eventEmitter - the event emitter
   * @typeParam agentConfig - the agent config
   * @typeParam connectionService - the connection service
   *
   * @public
   */

  public constructor(
    dispatcher: Dispatcher,
    mediationService: MediatorService,
    messagePickupService: MessagePickupService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    agentConfig: AgentConfig,
    connectionService: ConnectionService
  ) {
    this.mediatorService = mediationService
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.registerHandlers(dispatcher)
  }

  /**
   * grant requested mediation.
   *
   * @remarks
   *
   * @example
   * @typeParam mediatorId - The id of mediation request to accept.
   * @returns the mediation record of the granted request.
   *
   * @public
   */
  public async grantRequestedMediation(mediatorId: string): Promise<MediationRecord> {
    const record = await this.mediatorService.getById(mediatorId)
    const connectionRecord = await this.connectionService.getById(record.connectionId)

    const { message, mediationRecord } = await this.mediatorService.createGrantMediationMessage(record)
    const outboundMessage = createOutboundMessage(connectionRecord, message)

    await this.messageSender.sendMessage(outboundMessage)

    return mediationRecord
  }

  /**
   * queue a message for a recipient of mediation.
   *
   * @remarks
   *
   * @example
   *
   * @typeParam connectionId - The ID of the connection with the recipient.
   * @typeParam message - The message to add to the queue.
   * @returns
   *
   * @public
   */
  public queueMessage(connectionId: string, message: WireMessage) {
    return this.messagePickupService.queueMessage(connectionId, message)
  }

  /**
   * register message handlers for mediation recipient module
   *
   * @remarks
   * internal method to register message handlers/
   * @example
   *
   * @typeParam dispatcher - the dispatcher to
   * @internal
   */
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.mediatorService))
    dispatcher.registerHandler(new ForwardHandler(this.mediatorService, this.connectionService, this.messageSender))
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService, this.agentConfig))
  }
}
