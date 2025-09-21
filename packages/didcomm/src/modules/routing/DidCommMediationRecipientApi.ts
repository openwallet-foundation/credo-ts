import type { DidCommOutboundWebSocketClosedEvent, DidCommOutboundWebSocketOpenedEvent } from '../../transport'
import type { DidCommConnectionRecord } from '../connections/repository'
import type { DidCommMediationStateChangedEvent } from './DidCommRoutingEvents'
import type { DidCommMediationRecord } from './repository'
import type { GetRoutingOptions } from './services/DidCommRoutingService'

import {
  AgentContext,
  CredoError,
  DidDocument,
  DidsApi,
  EventEmitter,
  InjectionSymbols,
  Logger,
  filterContextCorrelationId,
  inject,
  injectable,
  verkeyToDidKey,
} from '@credo-ts/core'
import { ReplaySubject, Subject, firstValueFrom, interval, merge, timer } from 'rxjs'
import { delayWhen, filter, first, takeUntil, tap, throttleTime, timeout } from 'rxjs/operators'

import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommMessageSender } from '../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { DidCommOutboundMessageContext } from '../../models'
import { DidCommTransportEventTypes } from '../../transport'
import { DidCommConnectionMetadataKeys } from '../connections/repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionService } from '../connections/services'
import { DidCommDiscoverFeaturesApi } from '../discover-features'
import { DidCommMessagePickupApi } from '../message-pickup/DidCommMessagePickupApi'
import { DidCommBatchPickupMessage } from '../message-pickup/protocol/v1'
import { DidCommStatusV2Message } from '../message-pickup/protocol/v2'

import { DidCommMediationRecipientModuleConfig } from './DidCommMediationRecipientModuleConfig'
import { DidCommMediatorPickupStrategy } from './DidCommMediatorPickupStrategy'
import { DidCommRoutingEventTypes } from './DidCommRoutingEvents'
import { DidCommKeylistUpdateResponseHandler } from './handlers/DidCommKeylistUpdateResponseHandler'
import { DidCommMediationDenyHandler } from './handlers/DidCommMediationDenyHandler'
import { DidCommMediationGrantHandler } from './handlers/DidCommMediationGrantHandler'
import { DidCommKeylistUpdate, DidCommKeylistUpdateAction, DidCommKeylistUpdateMessage } from './messages'
import { DidCommMediationState } from './models/DidCommMediationState'
import { DidCommMediationRepository } from './repository'
import { DidCommMediationRecipientService } from './services/DidCommMediationRecipientService'
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

  public constructor(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
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
    this.registerMessageHandlers(messageHandlerRegistry)
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

    // Reset back off interval when the websocket is successfully opened again
    this.eventEmitter
      .observable<DidCommOutboundWebSocketOpenedEvent>(DidCommTransportEventTypes.DidCommOutboundWebSocketOpenedEvent)
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
      .observable<DidCommOutboundWebSocketClosedEvent>(DidCommTransportEventTypes.DidCommOutboundWebSocketClosedEvent)
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
            if (pickupStrategy === DidCommMediatorPickupStrategy.PickUpV2LiveMode) {
              // Start Pickup v2 protocol in live mode (retrieve any queued message before)
              await this.messagePickupApi.pickupMessages({
                connectionId: mediator.connectionId,
                protocolVersion: 'v2',
                awaitCompletion: true,
              })

              await this.messagePickupApi.setLiveDeliveryMode({
                connectionId: mediator.connectionId,
                liveDelivery: true,
                protocolVersion: 'v2',
              })
            } else {
              await this.initiateImplicitMode(mediator)
            }
          } catch (error) {
            this.logger.warn('Unable to re-open websocket connection to mediator', { error })
          }
        },
        complete: () => this.logger.info(`Stopping pickup of messages from mediator '${mediator.id}'`),
      })
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

        await this.messagePickupApi.pickupMessages({
          connectionId: mediatorConnection.id,
          protocolVersion: 'v2',
          awaitCompletion: true,
        })

        await this.messagePickupApi.setLiveDeliveryMode({
          connectionId: mediatorConnection.id,
          liveDelivery: true,
          protocolVersion: 'v2',
        })

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

  public async notifyKeylistUpdate(connection: DidCommConnectionRecord, verkey: string, action?: DidCommKeylistUpdateAction) {
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

  // Register handlers for the several messages for the mediator.
  private registerMessageHandlers(messageHandlerRegistry: DidCommMessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new DidCommKeylistUpdateResponseHandler(this.mediationRecipientService))
    messageHandlerRegistry.registerMessageHandler(new DidCommMediationGrantHandler(this.mediationRecipientService))
    messageHandlerRegistry.registerMessageHandler(new DidCommMediationDenyHandler(this.mediationRecipientService))
    //messageHandlerRegistry.registerMessageHandler(new KeylistListHandler(this.mediationRecipientService)) // TODO: write this
  }
}
