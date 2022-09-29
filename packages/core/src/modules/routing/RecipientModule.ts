import type { Logger } from '../../logger'
import type { AgentMessageProcessedEvent } from '../../agent/Events'
import type { DIDCommV2Message } from '../../agent/didcomm'
import type { DependencyManager } from '../../plugins'
import type { OutboundWebSocketClosedEvent, OutboundWebSocketOpenedEvent } from '../../transport'
import type { OutboundMessage } from '../../types'
import type { ConnectionRecord } from '../connections'
import type { OutboundWebSocketClosedEvent } from '../../transport'
import type { MediationStateChangedEvent } from './RoutingEvents'
import type { MediationRecord } from './index'
import type { Subscription } from 'rxjs'
import type { GetRoutingOptions } from './services/RoutingService'

import { firstValueFrom, interval, of, ReplaySubject, timer } from 'rxjs'
import { catchError, delayWhen, filter, first, map, takeUntil, tap, throttleTime, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'
import { firstValueFrom, interval, merge, ReplaySubject, Subject, timer } from 'rxjs'
import { filter, first, takeUntil, throttleTime, timeout, tap, delayWhen } from 'rxjs/operators'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { AriesFrameworkError } from '../../error'
import { injectable, module } from '../../plugins'
import { TransportEventTypes } from '../../transport'
import { parseMessageType } from '../../utils/messageType'
import { ConnectionService } from '../connections/services'
import { DidService } from '../dids'
import { DiscloseMessage, DiscloseMessageV2, DiscoverFeaturesModule } from '../discover-features'
import { OutOfBandGoalCode, OutOfBandInvitationMessage } from '../out-of-band'
import { DidsModule } from '../dids'
import { DiscoverFeaturesModule } from '../discover-features'

import { TrustPingMessageV2 } from './../connections/messages'
import { MediatorPickupStrategy } from './MediatorPickupStrategy'
import { RoutingEventTypes } from './RoutingEvents'
import { DidListUpdateResponseHandler } from './handlers/DidListUpdateResponseHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { BatchPickupMessageV2 } from './messages/BatchPickupMessage'
import { MediationState } from './models/MediationState'
import { BatchPickupMessage, StatusRequestMessage } from './protocol'
import { MediationRepository, MediatorRoutingRepository } from './repository'
import { MediationRecipientService } from './services/MediationRecipientService'
import { Transports } from './types'
import { RoutingService } from './services/RoutingService'

const DEFAULT_WS_RECONNECTION_INTERVAL = 1500
const WS_RECONNECTION_INTERVAL_STEP = 500
const MAX_WS_RECONNECTION_INTERVAL = 5000

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
    this.logger = agentConfig.logger
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
      this.logger.warn('Unable to open websocket connection to mediator', { error })
    }
  }

  private async initiateImplicitPickup(mediator: MediationRecord) {
    let interval = DEFAULT_WS_RECONNECTION_INTERVAL

    // Listens to Outbound websocket closed events and will reopen the websocket connection
    // in a recursive back off strategy if it matches the following criteria:
    // - Agent is not shutdown
    // - Socket was for current mediation DID
    this.eventEmitter
      .observable<OutboundWebSocketClosedEvent>(TransportEventTypes.OutboundWebSocketClosedEvent)
      .pipe(
        // Stop when the agent shuts down
        takeUntil(this.agentConfig.stop$),
        filter((e) => e.payload.did === mediator.did),
        // Make sure we're not reconnecting multiple times
        throttleTime(interval),
        // Increase the interval (recursive back-off)
        tap(() => {
          if (interval < MAX_WS_RECONNECTION_INTERVAL) {
            interval += WS_RECONNECTION_INTERVAL_STEP
          }
        }),
        // Wait for interval time before reconnecting
        delayWhen(() => timer(interval))
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
        complete: () => this.agentConfig.logger.info(`Stopping pickup of messages from mediator '${mediator.id}'`),
      .subscribe(async () => {
        this.logger.warn(
          `Websocket connection to mediator with mediation DID '${mediator.did}' is closed, attempting to reconnect...`
        )
        // Try to reconnect to WebSocket and reset retry interval if successful
        this.openMediationWebSocket(mediator).then(() => (interval = DEFAULT_WS_RECONNECTION_INTERVAL))
      })

    await this.openMediationWebSocket(mediator)
  }

  private async initiateExplicitPickup(mediator: MediationRecord): Promise<Subscription> {
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
    const { mediatorPollingInterval } = this.agentConfig
    return interval(mediatorPollingInterval)
      .pipe(takeUntil(this.agentConfig.stop$))
      .subscribe(async () => {
        try {
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

    const mediatorPickupStrategy = pickupStrategy ?? (await this.getPickupStrategyForMediator(mediatorRecord))
    const mediatorConnection = await this.connectionService.getById(mediatorRecord.connectionId)

    switch (mediatorPickupStrategy) {
      case MediatorPickupStrategy.PickUpV2:
        this.agentConfig.logger.info(`Starting pickup of messages from mediator '${mediatorRecord.id}'`)
        await this.openWebSocketAndPickUp(mediatorRecord, mediatorPickupStrategy)
        await this.sendStatusRequest({ mediatorId: mediatorRecord.id })
        break
      case MediatorPickupStrategy.PickUpV1: {
        const stopConditions$ = merge(this.agentConfig.stop$, this.stopMessagePickup$).pipe()
        // Explicit means polling every X seconds with batch message
        this.agentConfig.logger.info(
          `Starting explicit (batch) pickup of messages from mediator '${mediatorRecord.id}'`
        )
        const subscription = interval(mediatorPollingInterval)
          .pipe(takeUntil(stopConditions$))
          .subscribe({
            next: async () => {
              await this.pickupMessages(mediatorConnection)
            },
            complete: () =>
              this.agentConfig.logger.info(`Stopping pickup of messages from mediator '${mediatorRecord.id}'`),
          })
        return subscription
      }
      case MediatorPickupStrategy.Implicit:
        // Implicit means sending ping once and keeping connection open. This requires a long-lived transport
        // such as WebSockets to work
        this.agentConfig.logger.info(`Starting implicit pickup of messages from mediator '${mediatorRecord.id}'`)
        await this.openWebSocketAndPickUp(mediatorRecord, mediatorPickupStrategy)
        break
      default:
        this.agentConfig.logger.info(
          `Skipping pickup of messages from mediator '${mediatorRecord.id}' due to pickup strategy none`
        )
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

  /**
   * Terminate all ongoing Message Pickup loops
   */
  public async stopMessagePickup() {
    this.stopMessagePickup$.next(true)
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
    const { protocolUri } = parseMessageType(BatchPickupMessageV2.type)

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
            (e.payload.message?.sender === mediator.did && e.payload.message.type === DiscloseMessageV2.type) ||
            (e.payload.connection?.id === mediator.connectionId && e.payload.message.type === DiscloseMessage.type)
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

        /**
         * Requests mediation for a given connection and sets that as default mediator.
         *
         * @param connection connection record which will be used for mediation
         * @returns mediation record
         */
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
}
