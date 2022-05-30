import type { Logger } from '../../logger'
import type { OutboundWebSocketClosedEvent } from '../../transport'
import type { OutboundMessage } from '../../types'
import type { ConnectionRecord } from '../connections'
import type { MediationStateChangedEvent } from './RoutingEvents'
import type { MediationRecord } from './index'
import type { GetRoutingOptions } from './services/MediationRecipientService'

import { firstValueFrom, interval, ReplaySubject, timer } from 'rxjs'
import { filter, first, takeUntil, throttleTime, timeout, tap, delayWhen } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageReceiver } from '../../agent/MessageReceiver'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { TransportEventTypes } from '../../transport'
import { ConnectionService } from '../connections/services'
import { DidsModule } from '../dids'
import { DiscoverFeaturesModule } from '../discover-features'

import { MediatorPickupStrategy } from './MediatorPickupStrategy'
import { RoutingEventTypes } from './RoutingEvents'
import { MessageDeliveryHandler, StatusHandler } from './handlers'
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { StatusRequestMessage } from './messages'
import { BatchPickupMessage } from './messages/BatchPickupMessage'
import { MediationState } from './models/MediationState'
import { MediationRepository } from './repository'
import { MediationRecipientService } from './services/MediationRecipientService'

@scoped(Lifecycle.ContainerScoped)
export class RecipientModule {
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private connectionService: ConnectionService
  private dids: DidsModule
  private messageSender: MessageSender
  private messageReceiver: MessageReceiver
  private eventEmitter: EventEmitter
  private logger: Logger
  private discoverFeaturesModule: DiscoverFeaturesModule
  private mediationRepository: MediationRepository

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    connectionService: ConnectionService,
    dids: DidsModule,
    messageSender: MessageSender,
    messageReceiver: MessageReceiver,
    eventEmitter: EventEmitter,
    discoverFeaturesModule: DiscoverFeaturesModule,
    mediationRepository: MediationRepository
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.dids = dids
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.messageReceiver = messageReceiver
    this.eventEmitter = eventEmitter
    this.logger = agentConfig.logger
    this.discoverFeaturesModule = discoverFeaturesModule
    this.mediationRepository = mediationRepository
    this.registerHandlers(dispatcher)
  }

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

  private async sendMessage(outboundMessage: OutboundMessage) {
    const { mediatorPickupStrategy } = this.agentConfig
    const transportPriority =
      mediatorPickupStrategy === MediatorPickupStrategy.Implicit
        ? { schemes: ['wss', 'ws'], restrictive: true }
        : undefined

    await this.messageSender.sendMessage(outboundMessage, {
      transportPriority,
      // TODO: add keepAlive: true to enforce through the public api
      // we need to keep the socket alive. It already works this way, but would
      // be good to make more explicit from the public facing API.
      // This would also make it easier to change the internal API later on.
      // keepAlive: true,
    })
  }

  private async openMediationWebSocket(mediator: MediationRecord) {
    const connection = await this.connectionService.getById(mediator.connectionId)
    const { message, connectionRecord } = await this.connectionService.createTrustPing(connection, {
      responseRequested: false,
    })

    const websocketSchemes = ['ws', 'wss']
    const didDocument = connectionRecord.theirDid && (await this.dids.resolveDidDocument(connectionRecord.theirDid))
    const services = didDocument && didDocument?.didCommServices
    const hasWebSocketTransport = services && services.some((s) => websocketSchemes.includes(s.protocolScheme))

    if (!hasWebSocketTransport) {
      throw new AriesFrameworkError('Cannot open websocket to connection without websocket service endpoint')
    }

    await this.messageSender.sendMessage(createOutboundMessage(connectionRecord, message), {
      transportPriority: {
        schemes: websocketSchemes,
        restrictive: true,
        // TODO: add keepAlive: true to enforce through the public api
        // we need to keep the socket alive. It already works this way, but would
        // be good to make more explicit from the public facing API.
        // This would also make it easier to change the internal API later on.
        // keepAlive: true,
      },
    })
  }

  private async openWebSocketAndPickUp(mediator: MediationRecord, pickupStrategy: MediatorPickupStrategy) {
    let interval = 50

    // Listens to Outbound websocket closed events and will reopen the websocket connection
    // in a recursive back off strategy if it matches the following criteria:
    // - Agent is not shutdown
    // - Socket was for current mediator connection id
    this.eventEmitter
      .observable<OutboundWebSocketClosedEvent>(TransportEventTypes.OutboundWebSocketClosedEvent)
      .pipe(
        // Stop when the agent shuts down
        takeUntil(this.agentConfig.stop$),
        filter((e) => e.payload.connectionId === mediator.connectionId),
        // Make sure we're not reconnecting multiple times
        throttleTime(interval),
        // Increase the interval (recursive back-off)
        tap(() => (interval *= 2)),
        // Wait for interval time before reconnecting
        delayWhen(() => timer(interval))
      )
      .subscribe(async () => {
        this.logger.warn(
          `Websocket connection to mediator with connectionId '${mediator.connectionId}' is closed, attempting to reconnect...`
        )
        try {
          if (pickupStrategy === MediatorPickupStrategy.PickUpV2) {
            // Start Pickup v2 protocol to receive messages received while websocket offline
            await this.sendStatusRequest({ mediatorId: mediator.id })
          } else {
            await this.openMediationWebSocket(mediator)
          }
        } catch (error) {
          this.logger.warn('Unable to re-open websocket connection to mediator', { error })
        }
      })
    try {
      if (pickupStrategy === MediatorPickupStrategy.Implicit) {
        await this.openMediationWebSocket(mediator)
      }
    } catch (error) {
      this.logger.warn('Unable to open websocket connection to mediator', { error })
    }
  }

  public async initiateMessagePickup(mediator: MediationRecord) {
    const { mediatorPollingInterval } = this.agentConfig
    const mediatorPickupStrategy = await this.getPickupStrategyForMediator(mediator)
    const mediatorConnection = await this.connectionService.getById(mediator.connectionId)

    switch (mediatorPickupStrategy) {
      case MediatorPickupStrategy.PickUpV2:
        this.agentConfig.logger.info(`Starting pickup of messages from mediator '${mediator.id}'`)
        await this.openWebSocketAndPickUp(mediator, mediatorPickupStrategy)
        await this.sendStatusRequest({ mediatorId: mediator.id })
        break
      case MediatorPickupStrategy.PickUpV1: {
        // Explicit means polling every X seconds with batch message
        this.agentConfig.logger.info(`Starting explicit (batch) pickup of messages from mediator '${mediator.id}'`)
        const subscription = interval(mediatorPollingInterval)
          .pipe(takeUntil(this.agentConfig.stop$))
          .subscribe(async () => {
            await this.pickupMessages(mediatorConnection)
          })
        return subscription
      }
      case MediatorPickupStrategy.Implicit:
        // Implicit means sending ping once and keeping connection open. This requires a long-lived transport
        // such as WebSockets to work
        this.agentConfig.logger.info(`Starting implicit pickup of messages from mediator '${mediator.id}'`)
        await this.openWebSocketAndPickUp(mediator, mediatorPickupStrategy)
        break
      default:
        this.agentConfig.logger.info(
          `Skipping pickup of messages from mediator '${mediator.id}' due to pickup strategy none`
        )
    }
  }

  private async sendStatusRequest(config: { mediatorId: string; recipientKey?: string }) {
    const mediationRecord = await this.mediationRecipientService.getById(config.mediatorId)

    const statusRequestMessage = await this.mediationRecipientService.createStatusRequest(mediationRecord, {
      recipientKey: config.recipientKey,
    })

    const mediatorConnection = await this.connectionService.getById(mediationRecord.connectionId)
    return this.messageSender.sendMessage(createOutboundMessage(mediatorConnection, statusRequestMessage))
  }

  private async getPickupStrategyForMediator(mediator: MediationRecord) {
    let mediatorPickupStrategy = mediator.pickupStrategy ?? this.agentConfig.mediatorPickupStrategy

    // If mediator pickup strategy is not configured we try to query if batch pickup
    // is supported through the discover features protocol
    if (!mediatorPickupStrategy) {
      const isPickUpV2Supported = await this.discoverFeaturesModule.isProtocolSupported(
        mediator.connectionId,
        StatusRequestMessage
      )
      if (isPickUpV2Supported) {
        mediatorPickupStrategy = MediatorPickupStrategy.PickUpV2
      } else {
        const isBatchPickupSupported = await this.discoverFeaturesModule.isProtocolSupported(
          mediator.connectionId,
          BatchPickupMessage
        )

        // Use explicit pickup strategy
        mediatorPickupStrategy = isBatchPickupSupported
          ? MediatorPickupStrategy.PickUpV1
          : MediatorPickupStrategy.Implicit
      }

      // Store the result so it can be reused next time
      mediator.pickupStrategy = mediatorPickupStrategy
      await this.mediationRepository.update(mediator)
    }

    return mediatorPickupStrategy
  }

  public async discoverMediation() {
    return this.mediationRecipientService.discoverMediation()
  }

  public async pickupMessages(mediatorConnection: ConnectionRecord) {
    mediatorConnection.assertReady()

    const batchPickupMessage = new BatchPickupMessage({ batchSize: 10 })
    const outboundMessage = createOutboundMessage(mediatorConnection, batchPickupMessage)
    await this.sendMessage(outboundMessage)
  }

  public async setDefaultMediator(mediatorRecord: MediationRecord) {
    return this.mediationRecipientService.setDefaultMediator(mediatorRecord)
  }

  public async requestMediation(connection: ConnectionRecord): Promise<MediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(connection)
    const outboundMessage = createOutboundMessage(connection, message)

    await this.sendMessage(outboundMessage)
    return mediationRecord
  }

  public async notifyKeylistUpdate(connection: ConnectionRecord, verkey: string) {
    const message = this.mediationRecipientService.createKeylistUpdateMessage(verkey)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.sendMessage(outboundMessage)
  }

  public async findByConnectionId(connectionId: string) {
    return await this.mediationRecipientService.findByConnectionId(connectionId)
  }

  public async getMediators() {
    return await this.mediationRecipientService.getMediators()
  }

  public async findDefaultMediator(): Promise<MediationRecord | null> {
    return this.mediationRecipientService.findDefaultMediator()
  }

  public async findDefaultMediatorConnection(): Promise<ConnectionRecord | null> {
    const mediatorRecord = await this.findDefaultMediator()

    if (mediatorRecord) {
      return this.connectionService.getById(mediatorRecord.connectionId)
    }

    return null
  }

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
    await this.sendMessage(outboundMessage)

    const event = await firstValueFrom(subject)
    return event.payload.mediationRecord
  }

  /**
   * Requests mediation for a given connection and sets that as default mediator.
   *
   * @param connection connection record which will be used for mediation
   * @returns mediation record
   */
  public async provision(connection: ConnectionRecord) {
    this.logger.debug('Connection completed, requesting mediation')

    let mediation = await this.findByConnectionId(connection.id)
    if (!mediation) {
      this.agentConfig.logger.info(`Requesting mediation for connection ${connection.id}`)
      mediation = await this.requestAndAwaitGrant(connection, 60000) // TODO: put timeout as a config parameter
      this.logger.debug('Mediation granted, setting as default mediator')
      await this.setDefaultMediator(mediation)
      this.logger.debug('Default mediator set')
    } else {
      this.agentConfig.logger.warn(
        `Mediator invitation has already been ${mediation.isReady ? 'granted' : 'requested'}`
      )
    }

    return mediation
  }

  public async getRouting(options: GetRoutingOptions) {
    return this.mediationRecipientService.getRouting(options)
  }

  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationGrantHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationDenyHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new StatusHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MessageDeliveryHandler(this.mediationRecipientService))
    //dispatcher.registerHandler(new KeylistListHandler(this.mediationRecipientService)) // TODO: write this
  }
}
