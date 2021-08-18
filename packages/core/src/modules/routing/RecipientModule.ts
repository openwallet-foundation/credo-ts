import type { ConnectionRecord } from '../connections'
import type { MediationStateChangedEvent } from './RoutingEvents'
import type { MediationRecord } from './index'

import { firstValueFrom, interval, ReplaySubject } from 'rxjs'
import { filter, first, takeUntil, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ConnectionService } from '../connections/services'

import { MediatorPickupStrategy } from './MediatorPickupStrategy'
import { RoutingEventTypes } from './RoutingEvents'
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { BatchPickupMessage } from './messages/BatchPickupMessage'
import { MediationState } from './models/MediationState'
import { MediationRecipientService } from './services/MediationRecipientService'

/**
 *
 * Represents a recipient of a Mediation relationship.
 *
 * @remarks
 *
 * Recipient is the client supporting code that enables agents to request
 * mediation and use the granted mediation information for future connections.
 * The RecipientModule class implements the needed code to not only retrieve messages
 * but to also have messages stored for later retrieval.
 * @public
 */
@scoped(Lifecycle.ContainerScoped)
export class RecipientModule {
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter

  /**
   * Creates an instance of RecipientModule.
   * @typeParam dispatcher - dispatcher registers handlers
   * @typeParam agentConfig - config from startup
   * @typeParam mediationRecipientService - service for recipient models
   * @typeParam connectionService - service for connection models
   * @typeParam messageSender - message sender that calls registered transport send message
   * @typeParam eventEmitter - event emitter
   */
  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
  }

  /**
   *
   *
   * @memberof RecipientModule
   */
  public async initialize() {
    const { defaultMediatorId, clearDefaultMediator } = this.agentConfig

    // Set default mediator by id
    if (defaultMediatorId) {
      const mediatorRecord = await this.mediationRecipientService.getById(defaultMediatorId)
      await this.mediationRecipientService.setDefaultMediator(mediatorRecord)
    }
    // Clear the stored default mediator
    else if (clearDefaultMediator) {
      await this.mediationRecipientService.clearDefaultMediator()
    }

    // Poll for messages from mediator
    const defaultMediator = await this.findDefaultMediator()
    if (defaultMediator) {
      await this.initiateMessagePickup(defaultMediator)
    }
  }

  /**
   *
   *
   * @param {MediationRecord} mediator
   * @return {*}
   * @memberof RecipientModule
   */
  public async initiateMessagePickup(mediator: MediationRecord) {
    const { mediatorPickupStrategy, mediatorPollingInterval } = this.agentConfig

    const mediatorConnection = await this.connectionService.getById(mediator.connectionId)

    // Explicit means polling every X seconds with batch message
    if (mediatorPickupStrategy === MediatorPickupStrategy.Explicit) {
      this.agentConfig.logger.info(`Starting explicit (batch) pickup of messages from mediator '${mediator.id}'`)
      const subscription = interval(mediatorPollingInterval)
        .pipe(takeUntil(this.agentConfig.stop$))
        .subscribe(async () => {
          await this.pickupMessages(mediatorConnection)
        })

      return subscription
    }

    // Implicit means sending ping once and keeping connection open. This requires a long-lived transport
    // such as WebSockets to work
    else if (mediatorPickupStrategy === MediatorPickupStrategy.Implicit) {
      this.agentConfig.logger.info(`Starting implicit pickup of messages from mediator '${mediator.id}'`)
      const { message, connectionRecord } = await this.connectionService.createTrustPing(mediatorConnection.id)
      await this.messageSender.sendMessage(createOutboundMessage(connectionRecord, message))
    } else {
      this.agentConfig.logger.info(
        `Skipping pickup of messages from mediator '${mediator.id}' due to pickup strategy none`
      )
    }
  }

  /**
   *
   *
   * @return {*}
   * @memberof RecipientModule
   */
  public async discoverMediation() {
    return this.mediationRecipientService.discoverMediation()
  }

  /**
   *
   *
   * @param {ConnectionRecord} mediatorConnection
   * @memberof RecipientModule
   */
  public async pickupMessages(mediatorConnection: ConnectionRecord) {
    mediatorConnection.assertReady()

    const batchPickupMessage = new BatchPickupMessage({ batchSize: 10 })
    const outboundMessage = createOutboundMessage(mediatorConnection, batchPickupMessage)
    await this.messageSender.sendMessage(outboundMessage)
  }

  /**
   *
   *
   * @param {MediationRecord} mediatorRecord
   * @return {*}
   * @memberof RecipientModule
   */
  public async setDefaultMediator(mediatorRecord: MediationRecord) {
    return this.mediationRecipientService.setDefaultMediator(mediatorRecord)
  }

  /**
   *
   *
   * @param {ConnectionRecord} connection
   * @return {*}  {Promise<MediationRecord>}
   * @memberof RecipientModule
   */
  public async requestMediation(connection: ConnectionRecord): Promise<MediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(connection)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)
    return mediationRecord
  }

  /**
   *
   *
   * @param {ConnectionRecord} connection
   * @param {string} verkey
   * @return {*}
   * @memberof RecipientModule
   */
  public async notifyKeylistUpdate(connection: ConnectionRecord, verkey: string) {
    const message = this.mediationRecipientService.createKeylistUpdateMessage(verkey)
    const outboundMessage = createOutboundMessage(connection, message)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  /**
   *
   *
   * @param {string} connectionId
   * @return {*}
   * @memberof RecipientModule
   */
  public async findByConnectionId(connectionId: string) {
    return await this.mediationRecipientService.findByConnectionId(connectionId)
  }

  /**
   *
   *
   * @return {*}
   * @memberof RecipientModule
   */
  public async getMediators() {
    return await this.mediationRecipientService.getMediators()
  }

  /**
   *
   *
   * @return {*}  {(Promise<MediationRecord | null>)}
   * @memberof RecipientModule
   */
  public async findDefaultMediator(): Promise<MediationRecord | null> {
    return this.mediationRecipientService.findDefaultMediator()
  }

  /**
   *
   *
   * @return {*}  {(Promise<ConnectionRecord | null>)}
   * @memberof RecipientModule
   */
  public async findDefaultMediatorConnection(): Promise<ConnectionRecord | null> {
    const mediatorRecord = await this.findDefaultMediator()

    if (mediatorRecord) {
      return this.connectionService.getById(mediatorRecord.connectionId)
    }

    return null
  }

  /**
   *
   *
   * @param {ConnectionRecord} connection
   * @param {number} [timeoutMs=10000]
   * @return {*}  {Promise<MediationRecord>}
   * @memberof RecipientModule
   */
  public async requestAndAwaitGrant(connection: ConnectionRecord, timeoutMs = 10000): Promise<MediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(connection)

    // Create observable for event
    const observable = this.eventEmitter.observable<MediationStateChangedEvent>(RoutingEventTypes.MediationStateChanged)
    const subject = new ReplaySubject<MediationStateChangedEvent>(1)

    // Apply required filters to observable stream subscribe to replay subject
    observable
      .pipe(
        // Only take event for current mediation record
        filter((event) => event.payload.mediationRecord.id === mediationRecord.id),
        // Only take event for previous state requested, current state granted
        filter((event) => event.payload.previousState === MediationState.Requested),
        filter((event) => event.payload.mediationRecord.state === MediationState.Granted),
        // Only wait for first event that matches the criteria
        first(),
        // Do not wait for longer than specified timeout
        timeout(timeoutMs)
      )
      .subscribe(subject)

    // Send mediation request message
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    const event = await firstValueFrom(subject)
    return event.payload.mediationRecord
  }

  /**
   *
   *
   * @private
   * @param {Dispatcher} dispatcher
   * @memberof RecipientModule
   */
  private registerHandlers(dispatcher: Dispatcher) {
    // Register handlers for the several messages for the mediator.
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationGrantHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationDenyHandler(this.mediationRecipientService))
    //dispatcher.registerHandler(new KeylistListHandler(this.mediationRecipientService)) // TODO: write this
  }
}
