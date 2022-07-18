import type { AgentMessageProcessedEvent } from '../../agent/Events'
import type { Logger } from '../../logger'
import type { OutboundWebSocketClosedEvent } from '../../transport'
import type { OutboundDIDCommV2Message } from '../../types'
import type { MediationStateChangedEvent } from './RoutingEvents'
import type { MediationRecord } from './index'

import { firstValueFrom, interval, of, ReplaySubject, timer } from 'rxjs'
import { catchError, delayWhen, filter, first, map, takeUntil, tap, throttleTime, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { AgentEventTypes } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundDIDCommV2Message, createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { TransportEventTypes } from '../../transport'
import { parseMessageType } from '../../utils/messageType'
import { ConnectionService } from '../connections/services'
import { DidService, DidType } from '../dids'
import { DiscloseMessage, DiscloseMessageV2, DiscoverFeaturesModule } from '../discover-features'
import { OutOfBandGoalCode, OutOfBandInvitationMessage } from '../out-of-band'

import { MediatorPickupStrategy } from './MediatorPickupStrategy'
import { RoutingEventTypes } from './RoutingEvents'
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { BatchPickupMessageV2 } from './messages/BatchPickupMessage'
import { MediationState } from './models/MediationState'
import { MediationRepository } from './repository'
import { MediationRecipientService } from './services/MediationRecipientService'

@scoped(Lifecycle.ContainerScoped)
export class RecipientModule {
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private didService: DidService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger
  private discoverFeaturesModule: DiscoverFeaturesModule
  private mediationRepository: MediationRepository

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    didService: DidService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    discoverFeaturesModule: DiscoverFeaturesModule,
    mediationRepository: MediationRepository
  ) {
    this.agentConfig = agentConfig
    this.didService = didService
    this.connectionService = connectionService
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
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

  private async sendMessage(outboundMessage: OutboundDIDCommV2Message) {
    await this.messageSender.sendDIDCommV2Message(outboundMessage)
  }

  private async openMediationWebSocket(mediator: MediationRecord) {
    const { message, connectionRecord } = await this.connectionService.createTrustPing(mediator.did, {
      responseRequested: false,
    })

    const websocketSchemes = ['ws', 'wss']
    const hasWebSocketTransport = connectionRecord.theirDidDoc?.didCommServices?.some((s) =>
      websocketSchemes.includes(s.protocolScheme)
    )

    if (!hasWebSocketTransport) {
      throw new AriesFrameworkError('Cannot open websocket to connection without websocket service endpoint')
    }

    try {
      await this.messageSender.sendDIDCommV1Message(createOutboundMessage(connectionRecord, message), {
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
    } catch (error) {
      this.logger.warn('Unable to open websocket connection to mediator', { error })
    }
  }

  private async initiateImplicitPickup(mediator: MediationRecord) {
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
        filter((e) => e.payload.did === mediator.did),
        // Make sure we're not reconnecting multiple times
        throttleTime(interval),
        // Increase the interval (recursive back-off)
        tap(() => (interval *= 2)),
        // Wait for interval time before reconnecting
        delayWhen(() => timer(interval))
      )
      .subscribe(async () => {
        this.logger.warn(
          `Websocket connection to mediator with connectionId '${mediator.did}' is closed, attempting to reconnect...`
        )
        this.openMediationWebSocket(mediator)
      })

    await this.openMediationWebSocket(mediator)
  }

  public async initiateMessagePickup(mediator: MediationRecord) {
    const { mediatorPollingInterval } = this.agentConfig
    // Discover if mediator can do push notification
    // const mediatorPickupStrategy = await this.getPickupStrategyForMediator(mediator)
    const mediatorPickupStrategy = this.agentConfig.mediatorPickupStrategy

    // Explicit means polling every X seconds with batch message
    if (mediatorPickupStrategy === MediatorPickupStrategy.Explicit) {
      this.agentConfig.logger.info(`Starting explicit (batch) pickup of messages from mediator '${mediator.id}'`)
      const subscription = interval(mediatorPollingInterval)
        .pipe(takeUntil(this.agentConfig.stop$))
        .subscribe(async () => {
          await this.pickupMessages(mediator)
        })

      return subscription
    }

    // Implicit means sending ping once and keeping connection open. This requires a long-lived transport
    // such as WebSockets to work
    else if (mediatorPickupStrategy === MediatorPickupStrategy.Implicit) {
      this.agentConfig.logger.info(`Starting implicit pickup of messages from mediator '${mediator.id}'`)
      await this.initiateImplicitPickup(mediator)
    } else {
      this.agentConfig.logger.info(
        `Skipping pickup of messages from mediator '${mediator.id}' due to pickup strategy none`
      )
    }
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
      body: { batchSize: 10 },
    })
    const outboundMessage = createOutboundDIDCommV2Message(batchPickupMessage)
    await this.sendMessage(outboundMessage)
  }

  public async setDefaultMediator(mediatorRecord: MediationRecord) {
    return this.mediationRecipientService.setDefaultMediator(mediatorRecord)
  }

  public async notifyKeylistUpdate(did: string, verkey: string) {
    const message = this.mediationRecipientService.createKeylistUpdateMessage(did, verkey)
    const outboundMessage = createOutboundDIDCommV2Message(message)
    await this.sendMessage(outboundMessage)
  }

  public async getMediators() {
    return await this.mediationRecipientService.getMediators()
  }

  public async findDefaultMediator(): Promise<MediationRecord | null> {
    return this.mediationRecipientService.findDefaultMediator()
  }

  public async requestAndAwaitGrant(did: string, timeoutMs = 10000): Promise<MediationRecord> {
    const { mediationRecord, message } = await this.mediationRecipientService.createRequest(did)

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
    const outboundMessage = createOutboundDIDCommV2Message(message)
    await this.sendMessage(outboundMessage)

    const event = await firstValueFrom(subject)
    return event.payload.mediationRecord
  }

  public async provision(mediatorConnInvite: string) {
    this.logger.debug('Provision Mediation with invitation', { invite: mediatorConnInvite })
    // Connect to mediator through provided invitation
    // Also requests mediation and sets as default mediator
    // Assumption: processInvitation is a URL-encoded invitation
    const invitation = await OutOfBandInvitationMessage.fromUrl(mediatorConnInvite)

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

    const didForMediator = await this.didService.createDID(DidType.PeerDid)
    const mediationRecord = await this.requestAndAwaitGrant(didForMediator.did, 60000) // TODO: put timeout as a config parameter
    await this.setDefaultMediator(mediationRecord)
  }

  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationGrantHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationDenyHandler(this.mediationRecipientService))
    //dispatcher.registerHandler(new KeylistListHandler(this.mediationRecipientService)) // TODO: write this
  }
}
