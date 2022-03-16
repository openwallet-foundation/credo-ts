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
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { TransportEventTypes } from '../../transport'
import { ConnectionService } from '../connections/services'
import { OutOfBandModule } from '../oob/OutOfBandModule'

import { MediatorPickupStrategy } from './MediatorPickupStrategy'
import { RoutingEventTypes } from './RoutingEvents'
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { BatchPickupMessage } from './messages/BatchPickupMessage'
import { MediationState } from './models/MediationState'
import { MediationRecipientService } from './services/MediationRecipientService'

@scoped(Lifecycle.ContainerScoped)
export class RecipientModule {
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger
  private outOfBandModule: OutOfBandModule

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    connectionService: ConnectionService,
    outOfBandModule: OutOfBandModule,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.outOfBandModule = outOfBandModule
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.logger = agentConfig.logger
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
    const hasWebSocketTransport = connectionRecord.theirDidDoc?.didCommServices?.some((s) =>
      websocketSchemes.includes(s.protocolScheme)
    )

    if (!hasWebSocketTransport) {
      throw new AriesFrameworkError('Cannot open websocket to connection without websocket service endpoint')
    }

    try {
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
        this.openMediationWebSocket(mediator)
      })

    await this.openMediationWebSocket(mediator)
  }

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
      await this.initiateImplicitPickup(mediator)
    } else {
      this.agentConfig.logger.info(
        `Skipping pickup of messages from mediator '${mediator.id}' due to pickup strategy none`
      )
    }
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

  public async provision(mediatorConnInvite: string) {
    this.logger.debug('Provision Mediation with invitation', { invite: mediatorConnInvite })
    // Connect to mediator through provided invitation
    // Also requests mediation and sets as default mediator
    // We assume that mediatorConnInvite is a URL-encoded invitation

    const outOfBandMessage = await this.outOfBandModule.parseMessage(mediatorConnInvite)
    const outOfBandRecord = await this.outOfBandModule.findByMessageId(outOfBandMessage.id)
    const connection = outOfBandRecord && (await this.connectionService.findByOutOfBandId(outOfBandRecord.id))

    let mediationRecord: MediationRecord | null = null
    if (!connection) {
      this.logger.debug('Mediation Connection does not exist, creating connection')
      // We don't want to use the current default mediator when connecting to another mediator
      const routing = await this.mediationRecipientService.getRouting({ useDefaultMediator: false })

      this.logger.debug('Routing created', routing)
      const { outOfBandRecord, connectionRecord: invitationConnectionRecord } =
        await this.outOfBandModule.receiveMessage(outOfBandMessage, {
          autoAcceptMessage: true,
          autoAcceptConnection: true,
          routing,
        })
      this.logger.debug('Processed mediation invitation', { outOfBandRecord })
      if (!invitationConnectionRecord) {
        throw new AriesFrameworkError('No connection record to provision do some change mediation.')
      }

      const completedConnectionRecord = await this.connectionService.returnWhenIsConnected(
        invitationConnectionRecord.id
      )
      this.logger.debug('Connection completed, requesting mediation')
      mediationRecord = await this.requestAndAwaitGrant(completedConnectionRecord, 60000) // TODO: put timeout as a config parameter
      this.logger.debug('Mediation Granted, setting as default mediator')
      await this.setDefaultMediator(mediationRecord)
      this.logger.debug('Default mediator set')
    } else if (connection && !connection.isReady) {
      const connectionRecord = await this.connectionService.returnWhenIsConnected(connection.id)
      mediationRecord = await this.requestAndAwaitGrant(connectionRecord, 60000) // TODO: put timeout as a config parameter
      await this.setDefaultMediator(mediationRecord)
    } else {
      this.agentConfig.logger.warn('Mediator Invitation in configuration has already been used to create a connection.')
      const mediator = await this.findByConnectionId(connection.id)
      if (!mediator) {
        this.agentConfig.logger.warn('requesting mediation over connection.')
        mediationRecord = await this.requestAndAwaitGrant(connection, 60000) // TODO: put timeout as a config parameter
        await this.setDefaultMediator(mediationRecord)
      } else {
        this.agentConfig.logger.warn(
          `Mediator Invitation in configuration has already been ${
            mediator.isReady ? 'granted' : 'requested'
          } mediation`
        )
      }
    }

    return mediationRecord
  }

  public async getRouting(options: GetRoutingOptions) {
    return this.mediationRecipientService.getRouting(options)
  }

  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationGrantHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationDenyHandler(this.mediationRecipientService))
    //dispatcher.registerHandler(new KeylistListHandler(this.mediationRecipientService)) // TODO: write this
  }
}
