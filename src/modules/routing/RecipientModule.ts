import { Lifecycle, scoped } from 'tsyringe'
import type { Verkey } from 'indy-sdk'

import { AgentConfig } from '../../agent/AgentConfig'
import { assertConnection, RecipientService } from './services'
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ConnectionService } from '../connections'
import { BatchPickupMessage } from './messages'
import { Dispatcher } from '../../agent/Dispatcher'
import { ConnectionRecord } from '../connections'
import { MediationRecord } from '.'
import { MediationState, MediationStateChangedEvent } from '../..'
import { ConnectionsModule } from '../connections/ConnectionsModule'
import { EventEmitter } from '../../agent/EventEmitter'
import { KeylistUpdateEvent, RoutingEventTypes } from './RoutingEvents'
import { AriesFrameworkError } from '../../error'

@scoped(Lifecycle.ContainerScoped)
export class RecipientModule {
  private agentConfig: AgentConfig
  private recipientService: RecipientService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    recipientService: RecipientService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.recipientService = recipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
    this.registerListeners()
  }

  public async init(connections: ConnectionsModule) {
    this.recipientService.init()
    if (this.agentConfig.mediatorConnectionsInvite) {
      /* --------------------------------
      | Connect to mediator through provided invitation
      | and send mediation request and set as default mediator.
      */
      // Check if inviation was provided in config
      // Assumption: processInvitation is a URL-encoded invitation
      const connectionRecord = await connections.receiveInvitationFromUrl(this.agentConfig.mediatorConnectionsInvite, {
        autoAcceptConnection: true,
        alias: 'InitedMediator', // TODO come up with a better name for this
      })
      await connections.returnWhenIsConnected(connectionRecord.id)
      await this.requestAndWaitForAcception(connectionRecord, this.eventEmitter, 2000) // TODO: put timeout as a config parameter
    }
    if (this.agentConfig.defaultMediatorId) {
      /*
      | Set the default mediator by ID
      */
      const mediatorRecord = await this.recipientService.findById(this.agentConfig.defaultMediatorId)
      if (mediatorRecord) {
        this.recipientService.setDefaultMediator(mediatorRecord)
      } else {
        this.agentConfig.logger.error('Mediator record not found from config')
        // TODO: Handle error properly - not found condition
      }
    }
    if (this.agentConfig.clearDefaultMediator) {
      /*
      | Clear the stored default mediator
      */
      this.recipientService.clearDefaultMediator()
    }
  }

  public async downloadMessages(mediatorConnection?: ConnectionRecord) {
    const mediationRecord: MediationRecord | undefined = await this.recipientService.getDefaultMediator()
    if (mediationRecord) {
      let connection: ConnectionRecord = await this.connectionService.getById(mediationRecord.connectionId)
      connection = assertConnection(connection, 'connection not found for default mediator')
      const batchPickupMessage = new BatchPickupMessage({ batchSize: 10 })
      const outboundMessage = createOutboundMessage(connection, batchPickupMessage)
      outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }

  public async requestMediation(connection: ConnectionRecord) {
    const [record, message] = await this.recipientService.createRequest(connection)
    const outboundMessage = createOutboundMessage(connection, message)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  public async notifyKeylistUpdate(connection: ConnectionRecord, verkey?: Verkey) {
    const message = await this.recipientService.createKeylistUpdateMessage(verkey)
    const outboundMessage = createOutboundMessage(connection, message)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  public async requestKeylist(connection: ConnectionRecord) {
    const message = this.recipientService.createKeylistQuery()
    const outboundMessage = createOutboundMessage(connection, message)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  public async getMediators() {
    return await this.recipientService.getMediators()
  }

  public async getDefaultMediatorId() {
    return await this.recipientService.getDefaultMediatorId()
  }

  public async getDefaultMediator(): Promise<MediationRecord | undefined> {
    return await this.recipientService.getDefaultMediator()
  }

  public async getDefaultMediatorConnection(): Promise<ConnectionRecord | undefined> {
    const mediatorRecord = await this.getDefaultMediator()
    if (mediatorRecord) {
      return await this.connectionService.getById(mediatorRecord.connectionId)
    }
    return undefined
  }
  public async requestAndWaitForAcception(
    connection: ConnectionRecord,
    emitter: EventEmitter,
    timeout: number
  ): Promise<MediationRecord> {
    /*
    | create mediation record and request.
    | register listener for mediation grant, before sending request to remove race condition
    | resolve record when mediator grants request. time out otherwise
    | send request message to mediator
    | return promise with listener
    */
    const [record, message] = await this.recipientService.createRequest(connection)
    const outboundMessage = createOutboundMessage(connection, message)
    const promise: Promise<MediationRecord> = new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      let timer: NodeJS.Timeout = setTimeout(() => {})
      const listener = (event: MediationStateChangedEvent) => {
        const previousStateMatches = MediationState.Init === event.payload.previousState
        const mediationIdMatches = record.id || event.payload.mediationRecord.id
        const stateMatches = record.state || event.payload.mediationRecord.state

        if (previousStateMatches && mediationIdMatches && stateMatches) {
          emitter.off<MediationStateChangedEvent>(RoutingEventTypes.MediationStateChanged, listener)
          clearTimeout(timer)
          resolve(event.payload.mediationRecord)
        }
      }
      emitter.on<MediationStateChangedEvent>(RoutingEventTypes.MediationStateChanged, listener)
      timer = setTimeout(() => {
        emitter.off<MediationStateChangedEvent>(RoutingEventTypes.MediationStateChanged, listener)
        reject(
          new AriesFrameworkError(
            'timeout waiting for mediator to grant mediation, initialized from mediation record id:' + record.id
          )
        )
      }, timeout)
    })
    await this.messageSender.sendMessage(outboundMessage)
    return promise
  }
  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.recipientService))
    dispatcher.registerHandler(new MediationGrantHandler(this.recipientService))
    dispatcher.registerHandler(new MediationDenyHandler(this.recipientService))
    //dispatcher.registerHandler(new KeylistListHandler(this.recipientService)) // TODO: write this
  }

  private registerListeners() {
    this.eventEmitter.on<KeylistUpdateEvent>(RoutingEventTypes.MediationKeylistUpdate, this.keylistUpdateEvent)
  }

  private async keylistUpdateEvent({ payload: { mediationRecord, message } }: KeylistUpdateEvent) {
    // new did has been created and mediator needs to be updated with the public key.
    const connectionRecord: ConnectionRecord = await this.connectionService.getById(mediationRecord.connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
  }
}
