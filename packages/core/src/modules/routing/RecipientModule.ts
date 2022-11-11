import type { AgentMessageProcessedEvent } from '../../agent/Events'
import type { DIDCommV2Message } from '../../agent/didcomm'
import type { Logger } from '../../logger'
import type { DependencyManager } from '../../plugins'
import type { OutboundWebSocketClosedEvent } from '../../transport'
import type { MediationStateChangedEvent } from './RoutingEvents'
import type { MediationRecord } from './repository'
import type { Subscription } from 'rxjs'

import {
  of,
  firstValueFrom,
  interval,
  ReplaySubject,
  Subject,
  startWith,
  throttleTime,
  tap,
  delayWhen,
  timer,
  merge,
} from 'rxjs'
import { catchError, map, filter, first, takeUntil, timeout } from 'rxjs/operators'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { AgentEventTypes } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { AriesFrameworkError } from '../../error'
import { LogContexts } from '../../logger'
import { injectable, module } from '../../plugins'
import { TransportEventTypes } from '../../transport'
import { ConnectionService } from '../connections/services/ConnectionService'
import { DidService, DidsModule } from '../dids'
import { DiscoverFeaturesModule } from '../discover-features/DiscoverFeaturesModule'
import { DiscloseMessage, DiscloseMessageV2 } from '../discover-features/messages'
import { OutOfBandGoalCode, OutOfBandInvitationMessage } from '../out-of-band'

import { TrustPingMessageV2 } from './../connections/messages'
import { MediatorPickupStrategy } from './MediatorPickupStrategy'
import { RoutingEventTypes } from './RoutingEvents'
import { DidListUpdateResponseHandler } from './handlers/DidListUpdateResponseHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { MediationState } from './models/MediationState'
import { BatchPickupMessageV2 } from './protocol/pickup/v1/messages'
import { MediationRepository, MediatorRoutingRepository } from './repository'
import { MediationRecipientService } from './services/MediationRecipientService'
import { RoutingService } from './services/RoutingService'
import { Transports } from './types'

@module()
@injectable()
export class RecipientModule {
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private didService: DidService
  private connectionService: ConnectionService
  private dids: DidsModule
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger
  private discoverFeaturesModule: DiscoverFeaturesModule
  private mediationRepository: MediationRepository
  private routingService: RoutingService

  // stopMessagePickup$ is used for stop message pickup signal
  private readonly stopMessagePickup$ = new Subject<boolean>()

  private readonly triggerMediatorReconnect$ = new Subject<void>()

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    didService: DidService,
    connectionService: ConnectionService,
    dids: DidsModule,
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    discoverFeaturesModule: DiscoverFeaturesModule,
    mediationRepository: MediationRepository,
    routingService: RoutingService
  ) {
    this.agentConfig = agentConfig
    this.didService = didService
    this.connectionService = connectionService
    this.dids = dids
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.logger = agentConfig.logger.createContextLogger(LogContexts.RecipientModule.context)
    this.discoverFeaturesModule = discoverFeaturesModule
    this.mediationRepository = mediationRepository
    this.routingService = routingService
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

  private async sendMessage(message: DIDCommV2Message) {
    await this.messageSender.sendDIDCommV2Message(message)
  }

  private async openMediationWebSocket(mediator: MediationRecord) {
    const message = new TrustPingMessageV2({
      from: mediator.did,
      to: mediator.mediatorDid,
      body: { responseRequested: false },
    })

    const websocketSchemes = ['ws', 'wss']
    const hasWebSocketTransport = this.agentConfig.transports.some((transport) => websocketSchemes.includes(transport))

    if (!hasWebSocketTransport) {
      throw new AriesFrameworkError('Cannot open websocket to connection without websocket transport')
    }

    try {
      await this.messageSender.sendDIDCommV2Message(message, undefined, [Transports.WSS, Transports.WS])
    } catch (error) {
      this.logger.warn('Unable to open websocket connection to mediator', {
        error,
        logId: LogContexts.RecipientModule.mediationWebSocketUnableToOpenConnection,
      })
      return Promise.reject('Failed to open mediation web socket')
    }
  }

  private async initiateImplicitPickup(mediator: MediationRecord) {
    // Listens to Outbound websocket closed events and will reopen the websocket connection
    // in a recursive back off strategy if it matches the following criteria:
    // - Agent is not shutdown
    // - Socket was for current mediation DID

    const { startReconnectIntervalMs, maxReconnectIntervalMs, intervalStepMs } =
      this.agentConfig.mediatorWebSocketConfig

    let interval = startReconnectIntervalMs

    merge(
      this.eventEmitter
        .observable<OutboundWebSocketClosedEvent>(TransportEventTypes.OutboundWebSocketClosedEvent)
        .pipe(map((event) => ({ mediatorDid: event.payload.did }))),
      this.triggerMediatorReconnect$.pipe(map(() => ({ mediatorDid: mediator.did })))
    )
      .pipe(
        // Stop when the agent shuts down
        takeUntil(this.agentConfig.stop$),
        filter(({ mediatorDid }) => mediatorDid === mediator.did),
        startWith(),
        // Make sure we're not reconnecting multiple times
        throttleTime(startReconnectIntervalMs),
        // Increase the interval (recursive back-off)
        tap(() => {
          if (interval < maxReconnectIntervalMs) {
            interval += intervalStepMs
          }
        }),
        // Wait for interval time before reconnecting
        delayWhen(() => timer(interval))
      )
      .subscribe(async () => {
        this.logger.warn(
          `Websocket connection to mediator with mediation DID '${mediator.did}' is closed, attempting to reconnect...`
        )

        const hasInternetAccess = await this.agentConfig.internetChecker.hasInternetAccess()
        if (!hasInternetAccess) {
          this.logger.warn(`Internet connection is not available, Websocket reconnection cancelled`)
          return
        }

        // Try to reconnect to WebSocket and reset retry interval if successful
        await this.openMediationWebSocket(mediator)
          .then(() => (interval = startReconnectIntervalMs))
          .catch(() => {
            //Nothing
            //Silence the error because we don't care about it
          })
      })
  }

  private async initiateExplicitPickup(mediator: MediationRecord): Promise<Subscription> {
    const { mediatorPollingInterval } = this.agentConfig
    return interval(mediatorPollingInterval)
      .pipe(takeUntil(this.agentConfig.stop$))
      .subscribe(async () => {
        try {
          const hasInternetAccess = await this.agentConfig.internetChecker.hasInternetAccess()
          if (!hasInternetAccess) {
            this.logger.debug('Internet connection is not available, explicit messages pickup skipped')
            return
          }
          await this.pickupMessages(mediator)
        } catch (e) {
          this.agentConfig.logger.error(`Unable to send pickup message to mediator. Error: ${e}`)
        }
      })
  }

  public async initiateMessagePickup(mediator: MediationRecord): Promise<Subscription | undefined> {
    // Discover if mediator can do push notification
    // const mediatorPickupStrategy = await this.getPickupStrategyForMediator(mediator)
    const mediatorPickupStrategy = this.agentConfig.mediatorPickupStrategy

    if (!mediatorPickupStrategy) {
      this.agentConfig.logger.info(
        `Skipping pickup of messages from mediator '${mediator.id}' due to undefined pickup strategy`
      )
      return
    }

    let pickupSubscription: Subscription | undefined

    // Explicit means polling every X seconds with batch message
    if (mediatorPickupStrategy === MediatorPickupStrategy.Explicit) {
      this.agentConfig.logger.info(`Starting explicit (batch) pickup of messages from mediator '${mediator.id}'`)
      pickupSubscription = await this.initiateExplicitPickup(mediator)
    }

    // Implicit means sending ping once and keeping connection open. This requires a long-lived transport
    // such as WebSockets to work
    else if (mediatorPickupStrategy === MediatorPickupStrategy.Implicit) {
      this.agentConfig.logger.info(`Starting implicit pickup of messages from mediator '${mediator.id}'`)
      await this.initiateImplicitPickup(mediator)
    }

    // Combined means using both Explicit (batch polling) and Implicit (WebSocket) pickup strategies
    else if (mediatorPickupStrategy === MediatorPickupStrategy.Combined) {
      this.agentConfig.logger.info(
        `Starting combined explicit/implicit pickup of messages from mediator '${mediator.id}'`
      )
      pickupSubscription = await this.initiateExplicitPickup(mediator)
      await this.initiateImplicitPickup(mediator)
    }

    return pickupSubscription
  }

  private async getPickupStrategyForMediator(mediator: MediationRecord) {
    let mediatorPickupStrategy = mediator.pickupStrategy ?? this.agentConfig.mediatorPickupStrategy

    // If mediator pickup strategy is not configured we try to query if batch pickup
    // is supported through the discover features protocol
    if (!mediatorPickupStrategy) {
      const isBatchPickupSupported = await this.isBatchPickupSupportedByMediator(mediator)

      // Use explicit pickup strategy
      mediatorPickupStrategy = isBatchPickupSupported
        ? MediatorPickupStrategy.Explicit
        : MediatorPickupStrategy.Implicit

      // Store the result so it can be reused next time
      mediator.pickupStrategy = mediatorPickupStrategy
      await this.mediationRepository.update(mediator)
    }

    return mediatorPickupStrategy
  }

  private async isBatchPickupSupportedByMediator(mediator: MediationRecord) {
    const { protocolUri } = BatchPickupMessageV2.type

    // Listen for response to our feature query
    const replaySubject = new ReplaySubject(1)
    this.eventEmitter
      .observable<AgentMessageProcessedEvent>(AgentEventTypes.AgentMessageProcessed)
      .pipe(
        // Stop when the agent shuts down
        takeUntil(this.agentConfig.stop$),
        // filter by mediator connection id and query disclose message type
        filter(
          (e) =>
            (e.payload.message?.sender === mediator.did &&
              e.payload.message.type === DiscloseMessageV2.type.messageTypeUri) ||
            (e.payload.connection?.id === mediator.connectionId &&
              e.payload.message.type === DiscloseMessage.type.messageTypeUri)
        ),
        // Return whether the protocol is supported
        map((e) => {
          const message = e.payload.message as DiscloseMessageV2
          return message.body.protocols.map((p) => p.protocolId).includes(protocolUri)
        }),
        // TODO: make configurable
        // If we don't have an answer in 7 seconds (no response, not supported, etc...) error
        timeout(7000),
        // We want to return false if an error occurred
        catchError(() => of(false))
      )
      .subscribe(replaySubject)

    await this.discoverFeaturesModule.queryFeatures(mediator.did, {
      query: protocolUri,
      comment: 'Detect if batch pickup is supported to determine pickup strategy for messages',
    })

    const isBatchPickupSupported = await firstValueFrom(replaySubject)
    return isBatchPickupSupported
  }

  public async discoverMediation() {
    return this.mediationRecipientService.discoverMediation()
  }

  public async pickupMessages(mediator: MediationRecord) {
    const batchPickupMessage = new BatchPickupMessageV2({
      from: mediator.did,
      to: mediator.mediatorDid,
      body: { batchSize: 10 },
    })
    await this.sendMessage(batchPickupMessage)
  }

  public async setDefaultMediator(mediatorRecord: MediationRecord) {
    return this.mediationRecipientService.setDefaultMediator(mediatorRecord)
  }

  public async notifyKeylistUpdate(mediatorRecord: MediationRecord, verkey: string) {
    const message = this.mediationRecipientService.createKeylistUpdateMessage(mediatorRecord, verkey)
    await this.sendMessage(message)
  }

  public async getMediators() {
    return await this.mediationRecipientService.getMediators()
  }

  public async findDefaultMediator(): Promise<MediationRecord | null> {
    return this.mediationRecipientService.findDefaultMediator()
  }

  public async findGrantedMediatorByDid(did: string): Promise<MediationRecord | null> {
    return this.mediationRecipientService.findGrantedByMediatorDid(did)
  }

  public async requestAndAwaitGrant(did: string, mediatorDid: string, timeoutMs = 10000): Promise<MediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(did, mediatorDid)

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
    await this.sendMessage(message)

    const event = await firstValueFrom(subject)
    return event.payload.mediationRecord
  }

  public async provision(mediatorConnInvite: string) {
    this.logger.debug('Provision Mediation with invitation', { invite: mediatorConnInvite })
    // Connect to mediator through provided invitation
    // Also requests mediation and sets as default mediator
    // Assumption: processInvitation is a URL-encoded invitation
    const invitation = await OutOfBandInvitationMessage.fromLink({ url: mediatorConnInvite })

    if (invitation.body.goalCode !== OutOfBandGoalCode.MediatorProvision) {
      throw new AriesFrameworkError(
        `Invalid mediation invitation. Invitation goalCode is different: ${invitation.body.goalCode}.`
      )
    }

    const existingMediationRecord = await this.mediationRecipientService.findDefaultMediator()
    if (existingMediationRecord) {
      this.agentConfig.logger.warn(
        `Mediator Invitation in configuration has already been ${existingMediationRecord.state} mediation`
      )
      return existingMediationRecord
    }

    const didForMediator = await this.didService.createDID({
      transports: [],
      needMediation: false,
    })
    const mediationRecord = await this.requestAndAwaitGrant(didForMediator.did, invitation.from, 60000) // TODO: put timeout as a config parameter
    await this.setDefaultMediator(mediationRecord)
  }

  public async stopMessagePickup() {
    this.stopMessagePickup$.next(true)
  }

  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new DidListUpdateResponseHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationGrantHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationDenyHandler(this.mediationRecipientService))
    //dispatcher.registerHandler(new KeylistListHandler(this.mediationRecipientService)) // TODO: write this
  }

  /**
   * Registers the dependencies of the mediator recipient module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(RecipientModule)

    // Services
    dependencyManager.registerSingleton(MediationRecipientService)
    dependencyManager.registerSingleton(RoutingService)

    // Repositories
    dependencyManager.registerSingleton(MediationRepository)
    dependencyManager.registerSingleton(MediatorRoutingRepository)
  }

  public reconnectToMediator(): void {
    this.triggerMediatorReconnect$.next()
  }
}
