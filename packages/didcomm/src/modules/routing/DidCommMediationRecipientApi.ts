import {
  AgentContext,
  CredoError,
  DidDocument,
  DidsApi,
  EventEmitter,
  filterContextCorrelationId,
  InjectionSymbols,
  inject,
  injectable,
  type Logger,
  verkeyToDidKey,
} from '@credo-ts/core'
import {
  firstValueFrom,
  interval,
  merge,
  type Observable,
  ReplaySubject,
  Subject,
  TimeoutError,
  timeout,
  timer,
} from 'rxjs'
import { exhaustMap, filter, first, map, takeUntil, tap } from 'rxjs/operators'
import type { DidCommMessageProcessedEvent } from '../../DidCommEvents'
import { DidCommEventTypes } from '../../DidCommEvents'
import { DidCommMessageSender } from '../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { MessageSendingError } from '../../errors'
import { DidCommOutboundMessageContext } from '../../models'
import type { DidCommOutboundWebSocketClosedEvent } from '../../transport'
import { DidCommTransportEventTypes } from '../../transport'
import type { DidCommConnectionRecord } from '../connections/repository'
import { DidCommConnectionMetadataKeys } from '../connections/repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionService } from '../connections/services'
import { DidCommDiscoverFeaturesApi } from '../discover-features'
import { DidCommMessagePickupApi } from '../message-pickup/DidCommMessagePickupApi'
import { DidCommBatchPickupMessage } from '../message-pickup/protocol/v1'
import { DidCommStatusRequestV2Message, DidCommStatusV2Message } from '../message-pickup/protocol/v2'
import { DidCommMessagePickupSessionService } from '../message-pickup/services/DidCommMessagePickupSessionService'
import { DidCommMediationRecipientModuleConfig } from './DidCommMediationRecipientModuleConfig'
import { DidCommMediatorPickupStrategy } from './DidCommMediatorPickupStrategy'
import type { DidCommMediationStateChangedEvent } from './DidCommRoutingEvents'
import { DidCommRoutingEventTypes } from './DidCommRoutingEvents'
import { DidCommKeylistUpdate, DidCommKeylistUpdateAction, DidCommKeylistUpdateMessage } from './messages'
import { DidCommMediationState } from './models/DidCommMediationState'
import type { DidCommMediationRecord } from './repository'
import { DidCommMediationRepository } from './repository'
import { DidCommMediationRecipientService } from './services/DidCommMediationRecipientService'
import type { GetRoutingOptions } from './services/DidCommRoutingService'
import { DidCommRoutingService } from './services/DidCommRoutingService'

@injectable()
export class DidCommMediationRecipientApi {
  public config: DidCommMediationRecipientModuleConfig

  private mediationRecipientService: DidCommMediationRecipientService
  private connectionService: DidCommConnectionService
  private dids: DidsApi
  private messageSender: DidCommMessageSender
  private eventEmitter: EventEmitter
  private logger: Logger
  private discoverFeaturesApi: DidCommDiscoverFeaturesApi
  private messagePickupApi: DidCommMessagePickupApi
  private mediationRepository: DidCommMediationRepository
  private routingService: DidCommRoutingService
  private agentContext: AgentContext
  private stop$: Subject<boolean>

  // stopMessagePickup$ is used for stop message pickup signal
  private readonly stopMessagePickup$ = new Subject<boolean>()
  private readonly liveModeCheckStarted$ = new Subject<string>()

  public constructor(
    mediationRecipientService: DidCommMediationRecipientService,
    connectionService: DidCommConnectionService,
    dids: DidsApi,
    messageSender: DidCommMessageSender,
    eventEmitter: EventEmitter,
    discoverFeaturesApi: DidCommDiscoverFeaturesApi,
    messagePickupApi: DidCommMessagePickupApi,
    mediationRepository: DidCommMediationRepository,
    routingService: DidCommRoutingService,
    @inject(InjectionSymbols.Logger) logger: Logger,
    agentContext: AgentContext,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>,
    mediationRecipientModuleConfig: DidCommMediationRecipientModuleConfig
  ) {
    this.connectionService = connectionService
    this.dids = dids
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.logger = logger
    this.discoverFeaturesApi = discoverFeaturesApi
    this.messagePickupApi = messagePickupApi
    this.mediationRepository = mediationRepository
    this.routingService = routingService
    this.agentContext = agentContext
    this.stop$ = stop$
    this.config = mediationRecipientModuleConfig
  }

  private async sendMessage(
    outboundMessageContext: DidCommOutboundMessageContext,
    pickupStrategy?: DidCommMediatorPickupStrategy
  ) {
    const mediatorPickupStrategy = pickupStrategy ?? this.config.mediatorPickupStrategy
    const transportPriority =
      mediatorPickupStrategy === DidCommMediatorPickupStrategy.Implicit
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

  /**
   * Implicit mode consists simply on initiating a long-lived session to a mediator and wait for the
   * messages to arrive automatically.
   *
   * In order to do initiate this session, we open a suitable connection (using WebSocket transport) and
   * send a Trust Ping message.
   *
   * @param mediator
   */
  private async initiateImplicitMode(mediator: DidCommMediationRecord) {
    const connection = await this.connectionService.getById(this.agentContext, mediator.connectionId)
    const { message, connectionRecord } = await this.connectionService.createTrustPing(this.agentContext, connection, {
      responseRequested: false,
    })

    const websocketSchemes = ['ws', 'wss']
    const didDocument = connectionRecord.theirDid && (await this.dids.resolveDidDocument(connectionRecord.theirDid))
    const services = (didDocument as DidDocument)?.didCommServices || []
    const hasWebSocketTransport = services?.some((s) => websocketSchemes.includes(s.protocolScheme))

    if (!hasWebSocketTransport) {
      throw new CredoError('Cannot open websocket to connection without websocket service endpoint')
    }

    await this.messageSender.sendMessage(
      new DidCommOutboundMessageContext(message, { agentContext: this.agentContext, connection: connectionRecord }),
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

  /**
   * Keep track of a persistent transport session with a mediator, trying to reconnect to it as
   * soon as it is disconnected, using a recursive back-off strategy
   *
   * @param mediator mediation record
   * @param pickupStrategy chosen pick up strategy (should be Implicit or PickUp in Live Mode)
   */
  private async monitorMediatorWebSocketEvents(
    mediator: DidCommMediationRecord,
    pickupStrategy: DidCommMediatorPickupStrategy
  ) {
    const { baseMediatorReconnectionIntervalMs, maximumMediatorReconnectionIntervalMs } = this.config
    let interval = baseMediatorReconnectionIntervalMs

    const stopConditions$ = merge(this.stop$, this.stopMessagePickup$).pipe()

    // FIXME: this won't work for tenant agents created by the tenants module as the agent context session
    // could be closed. I'm not sure we want to support this as you probably don't want different tenants opening
    // various websocket connections to mediators. However we should look at throwing an error or making sure
    // it is not possible to use the mediation module with tenant agents.

    // Listens to Outbound websocket closed events and will reopen the websocket connection
    // in a recursive back off strategy if it matches the following criteria:
    // - Agent is not shutdown
    // - Socket was for current mediator connection id
    this.eventEmitter
      .observable<DidCommOutboundWebSocketClosedEvent>(DidCommTransportEventTypes.DidCommOutboundWebSocketClosedEvent)
      .pipe(
        filter((e) => e.payload.connectionId === mediator.connectionId),
        // Make sure we're not reconnecting multiple times
        exhaustMap(() => {
          const delay = Math.min(interval, maximumMediatorReconnectionIntervalMs)
          const maximumDelay = Math.min(delay * 1.5, maximumMediatorReconnectionIntervalMs)
          return timer(delay / 2 + Math.random() * (maximumDelay - delay / 2))
        }),
        // Increase the interval (recursive back-off)
        tap(() => {
          interval = Math.min(interval * 2, maximumMediatorReconnectionIntervalMs)
        }),
        // Stop when the agent shuts down or stop message pickup signal is received
        // Last in the pipe so a pending reconnect is dropped too
        takeUntil(stopConditions$)
      )
      .subscribe({
        next: async () => {
          this.logger.debug(
            `Websocket connection to mediator with connectionId '${mediator.connectionId}' is closed, attempting to reconnect...`
          )
          const resetBackoff = (): void => {
            interval = baseMediatorReconnectionIntervalMs
          }
          try {
            if (pickupStrategy === DidCommMediatorPickupStrategy.PickUpV2LiveMode) {
              await this.setUpLiveMode(mediator.connectionId, resetBackoff)
            } else {
              await this.initiateImplicitMode(mediator)
              resetBackoff()
            }
          } catch (error) {
            this.logger.warn('Unable to re-open websocket connection to mediator', { error })
          }
        },
        complete: () => this.logger.info(`Stopping pickup of messages from mediator '${mediator.id}'`),
      })
  }

  private async setUpLiveMode(connectionId: string, onLive?: () => void): Promise<void> {
    const checksEnabled = this.liveModeChecksEnabled()
    const pickupStopped$ = merge(this.stop$, this.stopMessagePickup$)
    let socketClosed = false
    let pickupStopped = false
    const subscription = this.eventEmitter
      .observable<DidCommOutboundWebSocketClosedEvent>(DidCommTransportEventTypes.DidCommOutboundWebSocketClosedEvent)
      .pipe(filter((e) => e.payload.connectionId === connectionId))
      .subscribe(() => {
        socketClosed = true
      })
    subscription.add(
      pickupStopped$.subscribe(() => {
        pickupStopped = true
      })
    )

    try {
      await this.messagePickupApi
        .pickupMessages({ connectionId, protocolVersion: 'v2', awaitCompletion: true })
        .catch((error: unknown) => {
          // A slow drain carries on over this socket, live mode delivers whatever is left
          if (!(error instanceof TimeoutError)) throw error
        })
      if (socketClosed || pickupStopped) return
      await this.messagePickupApi
        .setLiveDeliveryMode({
          connectionId,
          liveDelivery: true,
          protocolVersion: 'v2',
          awaitConfirmation: checksEnabled,
          awaitConfirmationTimeoutMs: this.liveModeReplyTimeoutMs(),
        })
        .catch(async (error: unknown) => {
          // Credo 0.4 and the ACA-Py pickup plugin never answer live-delivery-change but do answer status-request
          if (!(error instanceof TimeoutError) || socketClosed || pickupStopped) throw error
          const connection = await this.connectionService.getById(this.agentContext, connectionId)
          const status = await this.checkLiveMode(connection, pickupStopped$)
          if (status?.liveDelivery === false) throw error
        })
    } catch (error) {
      const transportFailure = error instanceof MessageSendingError || error instanceof TimeoutError
      if (pickupStopped || !transportFailure) throw error
      // A socket that closed during setup already has a reconnect pending, closing now could hit its new socket
      if (!socketClosed && !this.closeMediatorSockets(connectionId)) throw error
      this.logger.warn(`Unable to set up live mode with mediator connection '${connectionId}', reconnecting`, { error })
      return
    } finally {
      subscription.unsubscribe()
    }

    if (socketClosed || pickupStopped) return
    if (checksEnabled) this.monitorLiveMode(connectionId, onLive)
    else onLive?.()
  }

  private liveModeChecksEnabled(): boolean {
    if (!this.config.liveModeCheckIntervalMs) return false
    const { outboundTransports } = this.agentContext.dependencyManager.resolve(DidCommModuleConfig)
    if (outboundTransports.some((transport) => transport.closeSocketByConnectionId)) return true
    this.logger.warn('Live mode checks need an outbound transport that implements closeSocketByConnectionId')
    return false
  }

  // Capped so a dead socket is noticed without waiting a full check interval
  private liveModeReplyTimeoutMs(): number {
    return Math.min(this.config.liveModeCheckIntervalMs, 10000)
  }

  private closeMediatorSockets(connectionId: string): boolean {
    const { outboundTransports } = this.agentContext.dependencyManager.resolve(DidCommModuleConfig)
    let closed = false
    for (const transport of outboundTransports) {
      if (transport.closeSocketByConnectionId?.(connectionId)) {
        closed = true
      }
    }
    return closed
  }

  private monitorLiveMode(connectionId: string, onLive?: () => void): void {
    this.liveModeCheckStarted$.next(connectionId)
    let stopped = false
    const stopped$ = merge(
      this.stop$,
      this.stopMessagePickup$,
      this.liveModeCheckStarted$.pipe(filter((id) => id === connectionId)),
      this.eventEmitter
        .observable<DidCommOutboundWebSocketClosedEvent>(DidCommTransportEventTypes.DidCommOutboundWebSocketClosedEvent)
        .pipe(filter((e) => e.payload.connectionId === connectionId))
    ).pipe(
      first(),
      tap(() => {
        stopped = true
      })
    )

    let liveDeliveryOff = false
    interval(this.config.liveModeCheckIntervalMs)
      .pipe(
        takeUntil(stopped$),
        exhaustMap(async () => {
          try {
            const connection = await this.connectionService.getById(this.agentContext, connectionId)
            if (stopped) return
            const status = await this.checkLiveMode(connection, stopped$)
            if (stopped) return
            // With queued messages the reply already triggered a delivery request, so that gets one interval to finish
            if (status?.liveDelivery === false && (status.messageCount === 0 || liveDeliveryOff)) {
              throw new CredoError('Mediator reports live mode is off for this socket')
            }
            liveDeliveryOff = status?.liveDelivery === false
            if (status && !liveDeliveryOff) onLive?.()
          } catch (error) {
            if (stopped) return
            this.logger.warn(`Live mode check failed for mediator connection '${connectionId}', reconnecting`, {
              error,
            })
            this.closeMediatorSockets(connectionId)
          }
        })
      )
      .subscribe()
  }

  private async checkLiveMode(
    connection: DidCommConnectionRecord,
    stopped$: Observable<unknown>
  ): Promise<DidCommStatusV2Message | undefined> {
    const statusRequest = new DidCommStatusRequestV2Message({})
    const { liveModeCheckThreadIds } = this.agentContext.dependencyManager.resolve(DidCommMessagePickupSessionService)

    liveModeCheckThreadIds.add(statusRequest.threadId)
    try {
      const [status] = await Promise.all([
        firstValueFrom(
          this.eventEmitter.observable<DidCommMessageProcessedEvent>(DidCommEventTypes.DidCommMessageProcessed).pipe(
            filterContextCorrelationId(this.agentContext.contextCorrelationId),
            map((e) => e.payload.message),
            filter(
              (message): message is DidCommStatusV2Message =>
                message instanceof DidCommStatusV2Message && message.threadId === statusRequest.threadId
            ),
            timeout(this.liveModeReplyTimeoutMs()),
            takeUntil(stopped$)
          ),
          { defaultValue: undefined }
        ),
        this.messageSender.sendMessage(
          new DidCommOutboundMessageContext(statusRequest, { agentContext: this.agentContext, connection }),
          { transportPriority: { schemes: ['wss', 'ws'], restrictive: true } }
        ),
      ])
      return status
    } finally {
      liveModeCheckThreadIds.delete(statusRequest.threadId)
    }
  }

  /**
   * Start a Message Pickup flow with a registered Mediator.
   *
   * @param mediator optional {MediationRecord} corresponding to the mediator to pick messages from. It will use
   * default mediator otherwise
   * @param pickupStrategy optional {DidCommMediatorPickupStrategy} to use in the loop. It will use Agent's default
   * strategy or attempt to find it by Discover Features otherwise
   * @returns
   */
  public async initiateMessagePickup(
    mediator?: DidCommMediationRecord,
    pickupStrategy?: DidCommMediatorPickupStrategy
  ) {
    const { mediatorPollingInterval } = this.config
    const mediatorRecord = mediator ?? (await this.findDefaultMediator())
    if (!mediatorRecord) {
      throw new CredoError('There is no mediator to pickup messages from')
    }

    const mediatorPickupStrategy = pickupStrategy ?? (await this.getPickupStrategyForMediator(mediatorRecord))
    const mediatorConnection = await this.connectionService.getById(this.agentContext, mediatorRecord.connectionId)

    switch (mediatorPickupStrategy) {
      case DidCommMediatorPickupStrategy.PickUpV1:
      case DidCommMediatorPickupStrategy.PickUpV2: {
        const stopConditions$ = merge(this.stop$, this.stopMessagePickup$).pipe()
        // PickUpV1/PickUpV2 means polling every X seconds with batch message
        const protocolVersion = mediatorPickupStrategy === DidCommMediatorPickupStrategy.PickUpV2 ? 'v2' : 'v1'

        this.logger.info(
          `Starting explicit pickup of messages from mediator '${mediatorRecord.id}' using ${protocolVersion}`
        )
        const subscription = interval(mediatorPollingInterval)
          .pipe(takeUntil(stopConditions$))
          .subscribe({
            next: async () => {
              await this.messagePickupApi.pickupMessages({
                connectionId: mediatorConnection.id,
                batchSize: this.config.maximumMessagePickup,
                protocolVersion,
              })
            },
            complete: () => this.logger.info(`Stopping pickup of messages from mediator '${mediatorRecord.id}'`),
          })
        return subscription
      }
      case DidCommMediatorPickupStrategy.PickUpV2LiveMode:
        // PickUp V2 in Live Mode will retrieve queued messages and then set up live delivery mode
        this.logger.info(`Starting Live Mode pickup of messages from mediator '${mediatorRecord.id}'`)
        await this.monitorMediatorWebSocketEvents(mediatorRecord, mediatorPickupStrategy)
        await this.setUpLiveMode(mediatorConnection.id)
        break
      case DidCommMediatorPickupStrategy.Implicit:
        // Implicit means sending ping once and keeping connection open. This requires a long-lived transport
        // such as WebSockets to work
        this.logger.info(`Starting implicit pickup of messages from mediator '${mediatorRecord.id}'`)
        await this.monitorMediatorWebSocketEvents(mediatorRecord, mediatorPickupStrategy)
        await this.initiateImplicitMode(mediatorRecord)
        break
      default:
        this.logger.info(`Skipping pickup of messages from mediator '${mediatorRecord.id}' due to pickup strategy none`)
    }
  }

  /**
   * Terminate all ongoing Message Pickup loops
   */
  public async stopMessagePickup() {
    this.stopMessagePickup$.next(true)
  }

  private async getPickupStrategyForMediator(mediator: DidCommMediationRecord) {
    let mediatorPickupStrategy = mediator.pickupStrategy ?? this.config.mediatorPickupStrategy

    // If mediator pickup strategy is not configured we try to query if batch pickup
    // is supported through the discover features protocol
    if (!mediatorPickupStrategy) {
      const discloseForPickupV2 = await this.discoverFeaturesApi.queryFeatures({
        connectionId: mediator.connectionId,
        protocolVersion: 'v1',
        queries: [{ featureType: 'protocol', match: DidCommStatusV2Message.type.protocolUri }],
        awaitDisclosures: true,
      })

      if (discloseForPickupV2.features?.find((item) => item.id === DidCommStatusV2Message.type.protocolUri)) {
        mediatorPickupStrategy = DidCommMediatorPickupStrategy.PickUpV2
      } else {
        const discloseForPickupV1 = await this.discoverFeaturesApi.queryFeatures({
          connectionId: mediator.connectionId,
          protocolVersion: 'v1',
          queries: [{ featureType: 'protocol', match: DidCommBatchPickupMessage.type.protocolUri }],
          awaitDisclosures: true,
        })
        // Use explicit pickup strategy
        mediatorPickupStrategy = discloseForPickupV1.features?.find(
          (item) => item.id === DidCommBatchPickupMessage.type.protocolUri
        )
          ? DidCommMediatorPickupStrategy.PickUpV1
          : DidCommMediatorPickupStrategy.Implicit
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

  public async setDefaultMediator(mediatorRecord: DidCommMediationRecord) {
    return this.mediationRecipientService.setDefaultMediator(this.agentContext, mediatorRecord)
  }

  public async requestMediation(connection: DidCommConnectionRecord): Promise<DidCommMediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(
      this.agentContext,
      connection
    )
    const outboundMessage = new DidCommOutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection: connection,
    })

    await this.sendMessage(outboundMessage)
    return mediationRecord
  }

  public async notifyKeylistUpdate(
    connection: DidCommConnectionRecord,
    verkey: string,
    action?: DidCommKeylistUpdateAction
  ) {
    // Use our useDidKey configuration unless we know the key formatting other party is using
    const didcommConfig = this.agentContext.dependencyManager.resolve(DidCommModuleConfig)
    let useDidKey = didcommConfig.useDidKeyInProtocols

    const useDidKeysConnectionMetadata = connection.metadata.get(DidCommConnectionMetadataKeys.UseDidKeysForProtocol)
    if (useDidKeysConnectionMetadata) {
      useDidKey = useDidKeysConnectionMetadata[DidCommKeylistUpdateMessage.type.protocolUri] ?? useDidKey
    }

    const message = this.mediationRecipientService.createKeylistUpdateMessage([
      new DidCommKeylistUpdate({
        action: action ?? DidCommKeylistUpdateAction.add,
        recipientKey: useDidKey ? verkeyToDidKey(verkey) : verkey,
      }),
    ])

    const outboundMessageContext = new DidCommOutboundMessageContext(message, {
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

  public async findDefaultMediator(): Promise<DidCommMediationRecord | null> {
    return this.mediationRecipientService.findDefaultMediator(this.agentContext)
  }

  public async findDefaultMediatorConnection(): Promise<DidCommConnectionRecord | null> {
    const mediatorRecord = await this.findDefaultMediator()

    if (mediatorRecord) {
      return this.connectionService.getById(this.agentContext, mediatorRecord.connectionId)
    }

    return null
  }

  public async requestAndAwaitGrant(
    connection: DidCommConnectionRecord,
    timeoutMs = 10000
  ): Promise<DidCommMediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(
      this.agentContext,
      connection
    )

    // Create observable for event
    const observable = this.eventEmitter.observable<DidCommMediationStateChangedEvent>(
      DidCommRoutingEventTypes.MediationStateChanged
    )
    const subject = new ReplaySubject<DidCommMediationStateChangedEvent>(1)

    // Apply required filters to observable stream subscribe to replay subject
    observable
      .pipe(
        filterContextCorrelationId(this.agentContext.contextCorrelationId),
        // Only take event for current mediation record
        filter((event) => event.payload.mediationRecord.id === mediationRecord.id),
        // Only take event for previous state requested, current state granted
        filter((event) => event.payload.previousState === DidCommMediationState.Requested),
        filter((event) => event.payload.mediationRecord.state === DidCommMediationState.Granted),
        // Only wait for first event that matches the criteria
        first(),
        // Do not wait for longer than specified timeout
        timeout({
          first: timeoutMs,
          meta: 'MediationRecipientApi.requestAndAwaitGrant',
        })
      )
      .subscribe(subject)

    // Send mediation request message
    const outboundMessageContext = new DidCommOutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection: connection,
      associatedRecord: mediationRecord,
    })
    await this.sendMessage(outboundMessageContext)

    const event = await firstValueFrom(subject)
    return event.payload.mediationRecord
  }

  /**
   * Requests mediation for a given connection and sets that as default mediator.
   *
   * @param connection connection record which will be used for mediation
   * @returns mediation record
   */
  // TODO: we should rename this method, to something that is more descriptive
  public async provision(connection: DidCommConnectionRecord) {
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
}
