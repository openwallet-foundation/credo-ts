import type { OutboundWebSocketClosedEvent } from '../../transport'
import type { OutboundMessage } from '../../types'
import type { ConnectionRecord } from '../connections'
import type { MediationStateChangedEvent } from './RoutingEvents'
import type { MediationRecord } from './repository'
import type { GetRoutingOptions } from './services/RoutingService'

import { firstValueFrom, interval, ReplaySubject, Subject, timer } from 'rxjs'
import { delayWhen, filter, first, takeUntil, tap, throttleTime, timeout } from 'rxjs/operators'

import { AgentContext } from '../../agent'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { filterContextCorrelationId } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger'
import { inject, injectable } from '../../plugins'
import { TransportEventTypes } from '../../transport'
import { ConnectionService } from '../connections/services'
import { DidsApi } from '../dids'
import { DiscoverFeaturesApi } from '../discover-features'

import { MediatorPickupStrategy } from './MediatorPickupStrategy'
import { RecipientModuleConfig } from './RecipientModuleConfig'
import { RoutingEventTypes } from './RoutingEvents'
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { MediationState } from './models/MediationState'
import { StatusRequestMessage, BatchPickupMessage } from './protocol'
import { StatusHandler, MessageDeliveryHandler } from './protocol/pickup/v2/handlers'
import { MediationRepository } from './repository'
import { MediationRecipientService } from './services/MediationRecipientService'
import { RoutingService } from './services/RoutingService'

@injectable()
export class RecipientApi {
  public config: RecipientModuleConfig

  private mediationRecipientService: MediationRecipientService
  private connectionService: ConnectionService
  private dids: DidsApi
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger
  private discoverFeaturesApi: DiscoverFeaturesApi
  private mediationRepository: MediationRepository
  private routingService: RoutingService
  private agentContext: AgentContext
  private stop$: Subject<boolean>

  public constructor(
    dispatcher: Dispatcher,
    mediationRecipientService: MediationRecipientService,
    connectionService: ConnectionService,
    dids: DidsApi,
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    discoverFeaturesApi: DiscoverFeaturesApi,
    mediationRepository: MediationRepository,
    routingService: RoutingService,
    @inject(InjectionSymbols.Logger) logger: Logger,
    agentContext: AgentContext,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>,
    recipientModuleConfig: RecipientModuleConfig
  ) {
    this.connectionService = connectionService
    this.dids = dids
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.logger = logger
    this.discoverFeaturesApi = discoverFeaturesApi
    this.mediationRepository = mediationRepository
    this.routingService = routingService
    this.agentContext = agentContext
    this.stop$ = stop$
    this.config = recipientModuleConfig
    this.registerHandlers(dispatcher)
  }

  public async initialize() {
    const { defaultMediatorId, clearDefaultMediator } = this.agentContext.config

    // Set default mediator by id
    if (defaultMediatorId) {
      const mediatorRecord = await this.mediationRecipientService.getById(this.agentContext, defaultMediatorId)
      await this.mediationRecipientService.setDefaultMediator(this.agentContext, mediatorRecord)
    }
    // Clear the stored default mediator
    else if (clearDefaultMediator) {
      await this.mediationRecipientService.clearDefaultMediator(this.agentContext)
    }

    // Poll for messages from mediator
    const defaultMediator = await this.findDefaultMediator()
    if (defaultMediator) {
      await this.initiateMessagePickup(defaultMediator)
    }
  }

  private async sendMessage(outboundMessage: OutboundMessage, pickupStrategy?: MediatorPickupStrategy) {
    const mediatorPickupStrategy = pickupStrategy ?? this.config.mediatorPickupStrategy
    const transportPriority =
      mediatorPickupStrategy === MediatorPickupStrategy.Implicit
        ? { schemes: ['wss', 'ws'], restrictive: true }
        : undefined

    await this.messageSender.sendMessage(this.agentContext, outboundMessage, {
      transportPriority,
      // TODO: add keepAlive: true to enforce through the public api
      // we need to keep the socket alive. It already works this way, but would
      // be good to make more explicit from the public facing API.
      // This would also make it easier to change the internal API later on.
      // keepAlive: true,
    })
  }

  private async openMediationWebSocket(mediator: MediationRecord) {
    const connection = await this.connectionService.getById(this.agentContext, mediator.connectionId)
    const { message, connectionRecord } = await this.connectionService.createTrustPing(this.agentContext, connection, {
      responseRequested: false,
    })

    const websocketSchemes = ['ws', 'wss']
    const didDocument = connectionRecord.theirDid && (await this.dids.resolveDidDocument(connectionRecord.theirDid))
    const services = didDocument && didDocument?.didCommServices
    const hasWebSocketTransport = services && services.some((s) => websocketSchemes.includes(s.protocolScheme))

    if (!hasWebSocketTransport) {
      throw new AriesFrameworkError('Cannot open websocket to connection without websocket service endpoint')
    }

    await this.messageSender.sendMessage(this.agentContext, createOutboundMessage(connectionRecord, message), {
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

    // FIXME: this won't work for tenant agents created by the tenants module as the agent context session
    // could be closed. I'm not sure we want to support this as you probably don't want different tenants opening
    // various websocket connections to mediators. However we should look at throwing an error or making sure
    // it is not possible to use the mediation module with tenant agents.

    // Listens to Outbound websocket closed events and will reopen the websocket connection
    // in a recursive back off strategy if it matches the following criteria:
    // - Agent is not shutdown
    // - Socket was for current mediator connection id
    this.eventEmitter
      .observable<OutboundWebSocketClosedEvent>(TransportEventTypes.OutboundWebSocketClosedEvent)
      .pipe(
        // Stop when the agent shuts down
        takeUntil(this.stop$),
        filter((e) => e.payload.connectionId === mediator.connectionId),
        // Make sure we're not reconnecting multiple times
        throttleTime(interval),
        // Increase the interval (recursive back-off)
        tap(() => (interval *= 2)),
        // Wait for interval time before reconnecting
        delayWhen(() => timer(interval))
      )
      .subscribe(async () => {
        this.logger.debug(
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
    const { mediatorPollingInterval } = this.config
    const mediatorPickupStrategy = await this.getPickupStrategyForMediator(mediator)
    const mediatorConnection = await this.connectionService.getById(this.agentContext, mediator.connectionId)

    switch (mediatorPickupStrategy) {
      case MediatorPickupStrategy.PickUpV2:
        this.logger.info(`Starting pickup of messages from mediator '${mediator.id}'`)
        await this.openWebSocketAndPickUp(mediator, mediatorPickupStrategy)
        await this.sendStatusRequest({ mediatorId: mediator.id })
        break
      case MediatorPickupStrategy.PickUpV1: {
        // Explicit means polling every X seconds with batch message
        this.logger.info(`Starting explicit (batch) pickup of messages from mediator '${mediator.id}'`)
        const subscription = interval(mediatorPollingInterval)
          .pipe(takeUntil(this.stop$))
          .subscribe(async () => {
            await this.pickupMessages(mediatorConnection)
          })
        return subscription
      }
      case MediatorPickupStrategy.Implicit:
        // Implicit means sending ping once and keeping connection open. This requires a long-lived transport
        // such as WebSockets to work
        this.logger.info(`Starting implicit pickup of messages from mediator '${mediator.id}'`)
        await this.openWebSocketAndPickUp(mediator, mediatorPickupStrategy)
        break
      default:
        this.logger.info(`Skipping pickup of messages from mediator '${mediator.id}' due to pickup strategy none`)
    }
  }

  private async sendStatusRequest(config: { mediatorId: string; recipientKey?: string }) {
    const mediationRecord = await this.mediationRecipientService.getById(this.agentContext, config.mediatorId)

    const statusRequestMessage = await this.mediationRecipientService.createStatusRequest(mediationRecord, {
      recipientKey: config.recipientKey,
    })

    const mediatorConnection = await this.connectionService.getById(this.agentContext, mediationRecord.connectionId)
    return this.messageSender.sendMessage(
      this.agentContext,
      createOutboundMessage(mediatorConnection, statusRequestMessage)
    )
  }

  private async getPickupStrategyForMediator(mediator: MediationRecord) {
    let mediatorPickupStrategy = mediator.pickupStrategy ?? this.config.mediatorPickupStrategy

    // If mediator pickup strategy is not configured we try to query if batch pickup
    // is supported through the discover features protocol
    if (!mediatorPickupStrategy) {
      const isPickUpV2Supported = await this.discoverFeaturesApi.isProtocolSupported(
        mediator.connectionId,
        StatusRequestMessage
      )
      if (isPickUpV2Supported) {
        mediatorPickupStrategy = MediatorPickupStrategy.PickUpV2
      } else {
        const isBatchPickupSupported = await this.discoverFeaturesApi.isProtocolSupported(
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
      await this.mediationRepository.update(this.agentContext, mediator)
    }

    return mediatorPickupStrategy
  }

  public async discoverMediation() {
    return this.mediationRecipientService.discoverMediation(this.agentContext)
  }

  public async pickupMessages(mediatorConnection: ConnectionRecord, pickupStrategy?: MediatorPickupStrategy) {
    mediatorConnection.assertReady()

    const pickupMessage =
      pickupStrategy === MediatorPickupStrategy.PickUpV2
        ? new StatusRequestMessage({})
        : new BatchPickupMessage({ batchSize: 10 })
    const outboundMessage = createOutboundMessage(mediatorConnection, pickupMessage)
    await this.sendMessage(outboundMessage, pickupStrategy)
  }

  public async setDefaultMediator(mediatorRecord: MediationRecord) {
    return this.mediationRecipientService.setDefaultMediator(this.agentContext, mediatorRecord)
  }

  public async requestMediation(connection: ConnectionRecord): Promise<MediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(
      this.agentContext,
      connection
    )
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
    return await this.mediationRecipientService.findByConnectionId(this.agentContext, connectionId)
  }

  public async getMediators() {
    return await this.mediationRecipientService.getMediators(this.agentContext)
  }

  public async findDefaultMediator(): Promise<MediationRecord | null> {
    return this.mediationRecipientService.findDefaultMediator(this.agentContext)
  }

  public async findDefaultMediatorConnection(): Promise<ConnectionRecord | null> {
    const mediatorRecord = await this.findDefaultMediator()

    if (mediatorRecord) {
      return this.connectionService.getById(this.agentContext, mediatorRecord.connectionId)
    }

    return null
  }

  public async requestAndAwaitGrant(connection: ConnectionRecord, timeoutMs = 10000): Promise<MediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(
      this.agentContext,
      connection
    )

    // Create observable for event
    const observable = this.eventEmitter.observable<MediationStateChangedEvent>(RoutingEventTypes.MediationStateChanged)
    const subject = new ReplaySubject<MediationStateChangedEvent>(1)

    // Apply required filters to observable stream subscribe to replay subject
    observable
      .pipe(
        filterContextCorrelationId(this.agentContext.contextCorrelationId),
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
      this.logger.info(`Requesting mediation for connection ${connection.id}`)
      mediation = await this.requestAndAwaitGrant(connection, 60000) // TODO: put timeout as a config parameter
      this.logger.debug('Mediation granted, setting as default mediator')
      await this.setDefaultMediator(mediation)
      this.logger.debug('Default mediator set')
    } else {
      this.logger.debug(`Mediator invitation has already been ${mediation.isReady ? 'granted' : 'requested'}`)
    }

    return mediation
  }

  public async getRouting(options: GetRoutingOptions) {
    return this.routingService.getRouting(this.agentContext, options)
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
