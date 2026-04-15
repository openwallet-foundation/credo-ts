import {
  AgentContext,
  CredoError,
  DidDocument,
  DidsApi,
  didDocumentToNumAlgo4Did,
  EventEmitter,
  filterContextCorrelationId,
  getAlternativeDidsForNumAlgo4Did,
  InjectionSymbols,
  inject,
  injectable,
  isShortFormDidPeer4,
  type Logger,
  verkeyToDidKey,
} from '@credo-ts/core'
import { firstValueFrom, interval, merge, ReplaySubject, Subject, timer } from 'rxjs'
import { delayWhen, filter, first, takeUntil, tap, throttleTime, timeout } from 'rxjs/operators'
import { DidCommMessageSender } from '../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { DidCommOutboundMessageContext } from '../../models'
import type { DidCommOutboundWebSocketClosedEvent, DidCommOutboundWebSocketOpenedEvent } from '../../transport'
import { DidCommTransportEventTypes } from '../../transport'
import { assertDidCommV1Connection, assertDidCommV2Connection } from '../../util/didcommVersion'
import type { DidCommConnectionRecord } from '../connections/repository'
import { DidCommConnectionMetadataKeys } from '../connections/repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionService } from '../connections/services'
import { DidCommDiscoverFeaturesApi } from '../discover-features'
import { DidCommMessagePickupApi } from '../message-pickup/DidCommMessagePickupApi'
import { DidCommBatchPickupMessage } from '../message-pickup/protocol/v1'
import { DidCommStatusV2Message } from '../message-pickup/protocol/v2'
import { DidCommMediationRecipientModuleConfig } from './DidCommMediationRecipientModuleConfig'
import { DidCommMediatorPickupStrategy } from './DidCommMediatorPickupStrategy'
import type { DidCommMediationStateChangedEvent } from './DidCommRoutingEvents'
import { DidCommRoutingEventTypes } from './DidCommRoutingEvents'
import { DidCommMediationRole } from './models/DidCommMediationRole'
import { DidCommMediationState } from './models/DidCommMediationState'
import { DidCommKeylistUpdate, DidCommKeylistUpdateAction, DidCommKeylistUpdateMessage } from './protocol/v1/messages'
import { KeylistUpdateActionV2 } from './protocol/v2/messages'
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
            } else if (pickupStrategy === DidCommMediatorPickupStrategy.PickUpV3LiveMode) {
              await this.messagePickupApi.pickupMessages({
                connectionId: mediator.connectionId,
                protocolVersion: 'v3',
                awaitCompletion: true,
              })

              await this.messagePickupApi.setLiveDeliveryMode({
                connectionId: mediator.connectionId,
                liveDelivery: true,
                protocolVersion: 'v3',
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

    let mediatorPickupStrategy = pickupStrategy ?? (await this.getPickupStrategyForMediator(mediatorRecord))
    const mediatorConnection = await this.connectionService.getById(this.agentContext, mediatorRecord.connectionId)

    if (mediatorRecord.mediationProtocolVersion === 'v2') {
      assertDidCommV2Connection(mediatorConnection, 'Mediation 2.0')

      // Ensure pickup strategy is compatible with DIDComm v2 — upgrade v1/v2 pickup to v3
      if (
        mediatorPickupStrategy === DidCommMediatorPickupStrategy.PickUpV1 ||
        mediatorPickupStrategy === DidCommMediatorPickupStrategy.PickUpV2
      ) {
        mediatorPickupStrategy = DidCommMediatorPickupStrategy.PickUpV3
      } else if (mediatorPickupStrategy === DidCommMediatorPickupStrategy.PickUpV2LiveMode) {
        mediatorPickupStrategy = DidCommMediatorPickupStrategy.PickUpV3LiveMode
      }
    } else {
      assertDidCommV1Connection(mediatorConnection, 'Mediation')
    }

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
      case DidCommMediatorPickupStrategy.PickUpV3: {
        const stopConditions$ = merge(this.stop$, this.stopMessagePickup$).pipe()

        this.logger.info(`Starting explicit pickup of messages from mediator '${mediatorRecord.id}' using v3`)
        const subscription = interval(mediatorPollingInterval)
          .pipe(takeUntil(stopConditions$))
          .subscribe({
            next: async () => {
              await this.messagePickupApi.pickupMessages({
                connectionId: mediatorConnection.id,
                batchSize: this.config.maximumMessagePickup,
                protocolVersion: 'v3',
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
      case DidCommMediatorPickupStrategy.PickUpV3LiveMode:
        this.logger.info(`Starting Live Mode pickup of messages from mediator '${mediatorRecord.id}' using v3`)
        await this.monitorMediatorWebSocketEvents(mediatorRecord, mediatorPickupStrategy)

        await this.messagePickupApi.pickupMessages({
          connectionId: mediatorConnection.id,
          protocolVersion: 'v3',
          awaitCompletion: true,
        })

        await this.messagePickupApi.setLiveDeliveryMode({
          connectionId: mediatorConnection.id,
          liveDelivery: true,
          protocolVersion: 'v3',
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

    // For Coordinate Mediation 2.0 (DIDComm v2), message pickup v1/v2 protocols won't work
    // because the connection is v2 and those protocols require v1 connections.
    // Auto-upgrade to Message Pickup 3.0 equivalents.
    if (mediator.mediationProtocolVersion === 'v2') {
      if (
        !mediatorPickupStrategy ||
        mediatorPickupStrategy === DidCommMediatorPickupStrategy.PickUpV1 ||
        mediatorPickupStrategy === DidCommMediatorPickupStrategy.PickUpV2
      ) {
        mediatorPickupStrategy = DidCommMediatorPickupStrategy.PickUpV3
      } else if (mediatorPickupStrategy === DidCommMediatorPickupStrategy.PickUpV2LiveMode) {
        mediatorPickupStrategy = DidCommMediatorPickupStrategy.PickUpV3LiveMode
      }
      mediator.pickupStrategy = mediatorPickupStrategy
      await this.mediationRepository.update(this.agentContext, mediator)
      return mediatorPickupStrategy
    }

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

  /**
   * Send a mediation request for the given connection. Automatically selects
   * v1 or v2 Coordinate Mediation based on the connection's DIDComm version.
   */
  public async requestMediation(connection: DidCommConnectionRecord): Promise<DidCommMediationRecord> {
    const { mediationRecord, message } =
      (connection.didcommVersion ?? 'v1') === 'v2'
        ? await this.mediationRecipientService.createRequestV2(this.agentContext, connection)
        : await this.mediationRecipientService.createRequest(this.agentContext, connection)

    const outboundMessage = new DidCommOutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
    })

    await this.sendMessage(outboundMessage)
    return mediationRecord
  }

  /**
   * CM2 keylist tags are exact strings; senders may use long or short did:peer:4 in forward `next`.
   * Register every stable variant we can derive so the mediator finds the record.
   */
  private async recipientDidKeylistVariantsForProvision(recipientDid: string): Promise<string[]> {
    const variants = new Set<string>([recipientDid])
    getAlternativeDidsForNumAlgo4Did(recipientDid)?.forEach((d) => variants.add(d))
    if (isShortFormDidPeer4(recipientDid)) {
      try {
        const { didDocument } = await this.dids.resolve(recipientDid)
        if (didDocument) {
          const { longFormDid } = didDocumentToNumAlgo4Did(didDocument)
          variants.add(longFormDid)
          getAlternativeDidsForNumAlgo4Did(longFormDid)?.forEach((d) => variants.add(d))
        }
      } catch {
        // Resolution can fail for exotic stacks; primary did still sent
      }
    }
    return [...variants]
  }

  /**
   * Register (add/remove) a routing key or DID with the mediator. Automatically selects
   * the v1 or v2 keylist-update flow based on the mediation record's protocol version.
   *
   * For v1 the key is a verkey (or did:key) and action defaults to add.
   * For v2 the key is the recipient DID.
   */
  public async notifyKeylistUpdate(
    mediationRecord: DidCommMediationRecord,
    recipientKeyOrDid: string,
    action: DidCommKeylistUpdateAction = DidCommKeylistUpdateAction.add
  ): Promise<void> {
    mediationRecord.assertReady()
    mediationRecord.assertRole(DidCommMediationRole.Recipient)
    const connection = await this.connectionService.getById(this.agentContext, mediationRecord.connectionId)

    if (mediationRecord.mediationProtocolVersion === 'v2') {
      const message = this.mediationRecipientService.createKeylistUpdateV2Message(mediationRecord, [
        { recipientDid: recipientKeyOrDid, action: action as unknown as KeylistUpdateActionV2 },
      ])
      const outboundMessageContext = new DidCommOutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection,
      })
      await this.sendMessage(outboundMessageContext)
      return
    }

    // v1 flow
    const didcommConfig = this.agentContext.dependencyManager.resolve(DidCommModuleConfig)
    let useDidKey = didcommConfig.useDidKeyInProtocols
    const useDidKeysConnectionMetadata = connection.metadata.get(DidCommConnectionMetadataKeys.UseDidKeysForProtocol)
    if (useDidKeysConnectionMetadata) {
      useDidKey = useDidKeysConnectionMetadata[DidCommKeylistUpdateMessage.type.protocolUri] ?? useDidKey
    }

    const message = this.mediationRecipientService.createKeylistUpdateMessage([
      new DidCommKeylistUpdate({
        action,
        recipientKey: useDidKey ? verkeyToDidKey(recipientKeyOrDid) : recipientKeyOrDid,
      }),
    ])

    const outboundMessageContext = new DidCommOutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
    })
    await this.sendMessage(outboundMessageContext)
  }

  /**
   * Query the mediator's keylist. Only supported for Coordinate Mediation 2.0;
   * v1 has no public keylist-query method.
   */
  public async keylistQuery(
    mediationRecord: DidCommMediationRecord,
    paginate?: { limit: number; offset: number }
  ): Promise<void> {
    mediationRecord.assertReady()
    mediationRecord.assertRole(DidCommMediationRole.Recipient)
    if (mediationRecord.mediationProtocolVersion !== 'v2') {
      throw new CredoError('keylistQuery is only supported for Coordinate Mediation 2.0')
    }
    const connection = await this.connectionService.getById(this.agentContext, mediationRecord.connectionId)

    const message = this.mediationRecipientService.createKeylistQueryV2Message(mediationRecord, paginate)
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

  /**
   * Send a mediation request and wait for a grant. Automatically selects
   * v1 or v2 Coordinate Mediation based on the connection's DIDComm version.
   */
  public async requestAndAwaitGrant(
    connection: DidCommConnectionRecord,
    timeoutMs = 10000
  ): Promise<DidCommMediationRecord> {
    const { mediationRecord, message } =
      (connection.didcommVersion ?? 'v1') === 'v2'
        ? await this.mediationRecipientService.createRequestV2(this.agentContext, connection)
        : await this.mediationRecipientService.createRequest(this.agentContext, connection)

    const observable = this.eventEmitter.observable<DidCommMediationStateChangedEvent>(
      DidCommRoutingEventTypes.MediationStateChanged
    )
    const subject = new ReplaySubject<DidCommMediationStateChangedEvent>(1)

    observable
      .pipe(
        filterContextCorrelationId(this.agentContext.contextCorrelationId),
        filter((event) => event.payload.mediationRecord.id === mediationRecord.id),
        filter((event) => event.payload.previousState === DidCommMediationState.Requested),
        filter((event) => event.payload.mediationRecord.state === DidCommMediationState.Granted),
        first(),
        timeout({
          first: timeoutMs,
          meta: 'MediationRecipientApi.requestAndAwaitGrant',
        })
      )
      .subscribe(subject)

    const outboundMessageContext = new DidCommOutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: mediationRecord,
    })
    await this.sendMessage(outboundMessageContext)

    const event = await firstValueFrom(subject)
    return event.payload.mediationRecord
  }

  /**
   * Requests mediation for a given connection and sets that as default mediator.
   * Automatically selects v1 or v2 flow based on the connection's DIDComm version.
   * For v2, also performs the post-grant keylist-update required by the CM 2.0 spec.
   */
  public async provision(connection: DidCommConnectionRecord): Promise<DidCommMediationRecord> {
    const isV2 = (connection.didcommVersion ?? 'v1') === 'v2'
    this.logger.debug(`Connection completed, requesting mediation (${isV2 ? 'v2' : 'v1'})`)

    let mediation = await this.findByConnectionId(connection.id)
    if (mediation) {
      this.logger.debug(`Mediator invitation has already been ${mediation.isReady ? 'granted' : 'requested'}`)
      return mediation
    }

    this.logger.info(`Requesting mediation for connection ${connection.id}`)
    mediation = await this.requestAndAwaitGrant(connection, 60000)
    this.logger.debug('Mediation granted, setting as default mediator')
    await this.setDefaultMediator(mediation)
    this.logger.debug('Default mediator set')

    if (isV2) {
      // CM 2.0 post-grant: keylist-update to register the recipient DID with the mediator.
      const connectionRecord = await this.connectionService.getById(this.agentContext, connection.id)
      const recipientDid = connectionRecord.did
      if (recipientDid) {
        const toRegister = await this.recipientDidKeylistVariantsForProvision(recipientDid)
        this.logger.debug('Sending keylist-update to register recipient DID variant(s) with mediator', {
          toRegister,
        })
        mediation = await this.mediationRecipientService.keylistUpdateAndAwaitV2(
          this.agentContext,
          mediation,
          toRegister.map((did) => ({ recipientDid: did, action: KeylistUpdateActionV2.add })),
          15000
        )
      }
    }

    return mediation
  }

  public async getRouting(options: GetRoutingOptions) {
    return this.routingService.getRouting(this.agentContext, options)
  }
}
