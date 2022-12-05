import type { OutboundWebSocketClosedEvent, OutboundWebSocketOpenedEvent } from '../../transport'
import type { ConnectionRecord } from '../connections'
import type { MediationStateChangedEvent } from './RoutingEvents'
import type { MediationRequestMessage, V2MediationRequestMessage } from './protocol'
import type { MediationRecord } from './repository'
import type { GetRoutingOptions } from './services/MediationService'

import { firstValueFrom, interval, merge, ReplaySubject, Subject, timer } from 'rxjs'
import { delayWhen, filter, first, takeUntil, tap, throttleTime, timeout } from 'rxjs/operators'

import { AgentContext } from '../../agent'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { filterContextCorrelationId } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
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
import { MediationState } from './models/MediationState'
import { BatchPickupMessage, StatusMessage, StatusRequestMessage } from './protocol'
import { MediationRecipientService, V2MediationRecipientService } from './protocol/coordinate-mediation'
import { DeliveryRequestMessage } from './protocol/pickup/v3'
import { MediationRepository } from './repository'
import { MediationService } from './services/MediationService'

@injectable()
export class RecipientApi {
  public config: RecipientModuleConfig

  private mediationRecipientService: MediationRecipientService
  private v2MediationRecipientService: V2MediationRecipientService
  private connectionService: ConnectionService
  private dids: DidsApi
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger
  private discoverFeaturesApi: DiscoverFeaturesApi
  private mediationRepository: MediationRepository
  private mediationService: MediationService
  private agentContext: AgentContext
  private stop$: Subject<boolean>

  // stopMessagePickup$ is used for stop message pickup signal
  private readonly stopMessagePickup$ = new Subject<boolean>()

  public constructor(
    dispatcher: Dispatcher,
    mediationRecipientService: MediationRecipientService,
    v2MediationRecipientService: V2MediationRecipientService,
    connectionService: ConnectionService,
    dids: DidsApi,
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    discoverFeaturesApi: DiscoverFeaturesApi,
    mediationRepository: MediationRepository,
    routingService: MediationService,
    @inject(InjectionSymbols.Logger) logger: Logger,
    agentContext: AgentContext,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>,
    recipientModuleConfig: RecipientModuleConfig
  ) {
    this.connectionService = connectionService
    this.dids = dids
    this.mediationRecipientService = mediationRecipientService
    this.v2MediationRecipientService = v2MediationRecipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.logger = logger
    this.discoverFeaturesApi = discoverFeaturesApi
    this.mediationRepository = mediationRepository
    this.mediationService = routingService
    this.agentContext = agentContext
    this.stop$ = stop$
    this.config = recipientModuleConfig
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
      this.initiateMessagePickup(defaultMediator).catch((error) => {
        this.logger.warn(`Error initiating message pickup with mediator ${defaultMediator.id}`, { error })
      })
    }
  }

  private async sendMessage(outboundMessageContext: OutboundMessageContext, pickupStrategy?: MediatorPickupStrategy) {
    const mediatorPickupStrategy = pickupStrategy ?? this.config.mediatorPickupStrategy
    const transportPriority =
      mediatorPickupStrategy === MediatorPickupStrategy.Implicit
        ? { schemes: ['wss', 'ws'], restrictive: true }
        : undefined

    await this.messageSender.sendMessage(outboundMessageContext, {
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
    const services = didDocument && didDocument?.service

    const hasWebSocketTransport = services && services.some((s) => websocketSchemes.includes(s.protocolScheme))

    if (!hasWebSocketTransport) {
      throw new AriesFrameworkError('Cannot open websocket to connection without websocket service endpoint')
    }

    await this.messageSender.sendMessage(
      new OutboundMessageContext(message, { agentContext: this.agentContext, connection: connectionRecord }),
      {
        transportPriority: {
          schemes: websocketSchemes,
          restrictive: true,
          // TODO: add keepAlive: true to enforce through the public api
          // we need to keep the socket alive. It already works this way, but would
          // be good to make more explicit from the public facing API.
          // This would also make it easier to change the internal API later on.
          // keepAlive: true,
        },
      }
    )
  }

  private async openWebSocketAndPickUp(mediator: MediationRecord, pickupStrategy: MediatorPickupStrategy) {
    const { baseMediatorReconnectionIntervalMs, maximumMediatorReconnectionIntervalMs } = this.config
    let interval = baseMediatorReconnectionIntervalMs

    const stopConditions$ = merge(this.stop$, this.stopMessagePickup$).pipe()

    // Reset back off interval when the websocket is successfully opened again
    this.eventEmitter
      .observable<OutboundWebSocketOpenedEvent>(TransportEventTypes.OutboundWebSocketOpenedEvent)
      .pipe(
        // Stop when the agent shuts down or stop message pickup signal is received
        takeUntil(stopConditions$),
        filter((e) => e.payload.connectionId === mediator.connectionId)
      )
      .subscribe(() => {
        interval = baseMediatorReconnectionIntervalMs
      })

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
        // Stop when the agent shuts down or stop message pickup signal is received
        takeUntil(stopConditions$),
        filter((e) => e.payload.connectionId === mediator.connectionId),
        // Make sure we're not reconnecting multiple times
        throttleTime(interval),
        // Wait for interval time before reconnecting
        delayWhen(() => timer(interval)),
        // Increase the interval (recursive back-off)
        tap(() => {
          interval = Math.min(interval * 2, maximumMediatorReconnectionIntervalMs)
        })
      )
      .subscribe({
        next: async () => {
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
        },
        complete: () => this.logger.info(`Stopping pickup of messages from mediator '${mediator.id}'`),
      })
    try {
      if (pickupStrategy === MediatorPickupStrategy.Implicit) {
        await this.openMediationWebSocket(mediator)
      }
    } catch (error) {
      this.logger.warn('Unable to open websocket connection to mediator', { error })
    }
  }

  /**
   * Start a Message Pickup flow with a registered Mediator.
   *
   * @param mediator optional {MediationRecord} corresponding to the mediator to pick messages from. It will use
   * default mediator otherwise
   * @param pickupStrategy optional {MediatorPickupStrategy} to use in the loop. It will use Agent's default
   * strategy or attempt to find it by Discover Features otherwise
   * @returns
   */
  public async initiateMessagePickup(mediator?: MediationRecord, pickupStrategy?: MediatorPickupStrategy) {
    const mediatorRecord = mediator ?? (await this.findDefaultMediator())
    if (!mediatorRecord) {
      throw new AriesFrameworkError('There is no mediator to pickup messages from')
    }

    const mediatorPickupStrategy = pickupStrategy ?? (await this.getPickupStrategyForMediator(mediatorRecord))

    if (mediatorPickupStrategy === MediatorPickupStrategy.PickUpV1) {
      return this.initiateMessagePickupV1(mediatorRecord)
    }

    // pick up v2
    else if (mediatorPickupStrategy === MediatorPickupStrategy.PickUpV2) {
      return this.initiateMessagePickupV2(mediatorRecord, mediatorPickupStrategy)
    }

    // Explicit means polling every X seconds with batch message
    else if (mediatorPickupStrategy === MediatorPickupStrategy.PickUpV3) {
      return this.initiateMessagePickupV3(mediatorRecord)
    }

    // Implicit means sending ping once and keeping connection open. This requires a long-lived transport
    // such as WebSockets to work
    else if (mediatorPickupStrategy === MediatorPickupStrategy.Implicit) {
      return this.initiateImplicitMessagePickup(mediatorRecord, mediatorPickupStrategy)
    }
  }

  public async initiateMessagePickupV1(mediatorRecord: MediationRecord) {
    const { mediatorPollingInterval } = this.config
    const stopConditions$ = merge(this.stop$, this.stopMessagePickup$).pipe()

    // Explicit means polling every X seconds with batch message
    this.logger.info(`Starting explicit (batch) pickup of messages from mediator '${mediatorRecord.id}'`)

    const mediatorConnection = await this.connectionService.getById(this.agentContext, mediatorRecord.connectionId)

    return interval(mediatorPollingInterval)
      .pipe(takeUntil(stopConditions$))
      .subscribe({
        next: async () => {
          await this.pickupMessages(mediatorConnection)
        },
        complete: () => this.logger.info(`Stopping pickup of messages from mediator '${mediatorRecord.id}'`),
      })
  }

  public async initiateMessagePickupV2(
    mediatorRecord: MediationRecord,
    mediatorPickupStrategy: MediatorPickupStrategy
  ) {
    this.logger.info(`Starting pickup of messages from mediator '${mediatorRecord.id}'`)
    await this.openWebSocketAndPickUp(mediatorRecord, mediatorPickupStrategy)
    await this.sendStatusRequest({ mediatorId: mediatorRecord.id })
  }

  public async initiateMessagePickupV3(mediatorRecord: MediationRecord) {
    const { mediatorPollingInterval } = this.config
    const stopConditions$ = merge(this.stop$, this.stopMessagePickup$).pipe()

    // Explicit means polling every X seconds with batch message
    this.logger.info(`Starting explicit (batch) pickup of messages from mediator '${mediatorRecord.id}'`)

    const mediatorConnection = await this.connectionService.getById(this.agentContext, mediatorRecord.connectionId)

    return interval(mediatorPollingInterval)
      .pipe(takeUntil(stopConditions$))
      .subscribe({
        next: async () => {
          await this.pickupMessagesV3(mediatorConnection)
        },
        complete: () => this.logger.info(`Stopping pickup of messages from mediator '${mediatorRecord.id}'`),
      })
  }

  public async initiateImplicitMessagePickup(
    mediatorRecord: MediationRecord,
    mediatorPickupStrategy: MediatorPickupStrategy
  ) {
    // Implicit means sending ping once and keeping connection open. This requires a long-lived transport
    // such as WebSockets to work
    this.logger.info(`Starting implicit pickup of messages from mediator '${mediatorRecord.id}'`)
    await this.openWebSocketAndPickUp(mediatorRecord, mediatorPickupStrategy)
  }

  /**
   * Terminate all ongoing Message Pickup loops
   */
  public async stopMessagePickup() {
    this.stopMessagePickup$.next(true)
  }

  private async sendStatusRequest(config: { mediatorId: string; recipientKey?: string }) {
    const mediationRecord = await this.mediationRecipientService.getById(this.agentContext, config.mediatorId)

    const statusRequestMessage = await this.mediationRecipientService.createStatusRequest(mediationRecord, {
      recipientKey: config.recipientKey,
    })

    const mediatorConnection = await this.connectionService.getById(this.agentContext, mediationRecord.connectionId)
    return this.messageSender.sendMessage(
      new OutboundMessageContext(statusRequestMessage, {
        agentContext: this.agentContext,
        connection: mediatorConnection,
      })
    )
  }

  private async getPickupStrategyForMediator(mediator: MediationRecord) {
    let mediatorPickupStrategy = mediator.pickupStrategy ?? this.config.mediatorPickupStrategy

    const mediatorConnection = await this.connectionService.getById(this.agentContext, mediator.connectionId)

    if (mediatorConnection.isDidCommV2Connection) return MediatorPickupStrategy.PickUpV3

    // If mediator pickup strategy is not configured we try to query if batch pickup
    // is supported through the discover features protocol
    if (!mediatorPickupStrategy) {
      const discloseForPickupV2 = await this.discoverFeaturesApi.queryFeatures({
        connectionId: mediator.connectionId,
        protocolVersion: 'v1',
        queries: [{ featureType: 'protocol', match: StatusMessage.type.protocolUri }],
        awaitDisclosures: true,
      })

      if (discloseForPickupV2.features?.find((item) => item.id === StatusMessage.type.protocolUri)) {
        mediatorPickupStrategy = MediatorPickupStrategy.PickUpV2
      } else {
        const discloseForPickupV1 = await this.discoverFeaturesApi.queryFeatures({
          connectionId: mediator.connectionId,
          protocolVersion: 'v1',
          queries: [{ featureType: 'protocol', match: BatchPickupMessage.type.protocolUri }],
          awaitDisclosures: true,
        })
        // Use explicit pickup strategy
        mediatorPickupStrategy = discloseForPickupV1.features?.find(
          (item) => item.id === BatchPickupMessage.type.protocolUri
        )
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
    const outboundMessageContext = new OutboundMessageContext(pickupMessage, {
      agentContext: this.agentContext,
      connection: mediatorConnection,
    })
    await this.sendMessage(outboundMessageContext, pickupStrategy)
  }

  public async pickupMessagesV3(mediatorConnection: ConnectionRecord) {
    mediatorConnection.assertReady()

    const deliveryRequestMessage = new DeliveryRequestMessage({
      from: mediatorConnection.did,
      to: mediatorConnection.theirDid,
      body: { limit: 10 },
    })
    const outboundMessageContext = new OutboundMessageContext(deliveryRequestMessage, {
      agentContext: this.agentContext,
      connection: mediatorConnection,
    })
    await this.sendMessage(outboundMessageContext)
  }

  public async setDefaultMediator(mediatorRecord: MediationRecord) {
    return this.mediationRecipientService.setDefaultMediator(this.agentContext, mediatorRecord)
  }

  public async requestMediation(connection: ConnectionRecord): Promise<MediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(
      this.agentContext,
      connection
    )
    const outboundMessage = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection: connection,
    })

    await this.sendMessage(outboundMessage)
    return mediationRecord
  }

  public async notifyKeylistUpdate(connection: ConnectionRecord, verkey: string) {
    const message = this.mediationRecipientService.createKeylistUpdateMessage(verkey)
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
    })
    await this.sendMessage(outboundMessageContext)
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
    const { mediationRecord, message } = await this.createRequest(connection)

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
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection: connection,
      associatedRecord: mediationRecord,
    })
    await this.sendMessage(outboundMessageContext)

    const event = await firstValueFrom(subject)
    return event.payload.mediationRecord
  }

  public async createRequest(connection: ConnectionRecord): Promise<{
    mediationRecord: MediationRecord
    message: MediationRequestMessage | V2MediationRequestMessage
  }> {
    if (connection.isDidCommV1Connection) {
      const { mediationRecord, message } = await this.mediationRecipientService.createRequest(
        this.agentContext,
        connection
      )
      return { mediationRecord, message }
    } else {
      const { mediationRecord, message } = await this.v2MediationRecipientService.createRequest(
        this.agentContext,
        connection
      )
      return { mediationRecord, message }
    }
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
    return this.mediationService.getRouting(this.agentContext, options)
  }
}
