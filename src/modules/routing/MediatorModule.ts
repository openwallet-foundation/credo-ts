import { Lifecycle, scoped } from 'tsyringe'

import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { Dispatcher } from '../../agent/Dispatcher'
import { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import { KeylistUpdateHandler, ForwardHandler, BatchPickupHandler, BatchHandler } from './handlers'
import { MediatorService } from './services/MediatorService'
import { MessagePickupService } from './services/MessagePickupService'
import { ConnectionService } from '../connections'
import {
  MediationGrantedEvent,
  MediationKeylistUpdatedEvent,
  RoutingEventTypes,
  ForwardEvent,
  MediationKeylistEvent,
  MediationRecord,
} from '.'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { EventEmitter } from '../../agent/EventEmitter'
import {WireMessage} from '../../types'

@scoped(Lifecycle.ContainerScoped)
export class MediatorModule {
  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  public eventEmitter: EventEmitter

  public constructor(
    dispatcher: Dispatcher,
    mediationService: MediatorService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.mediatorService = mediationService
    this.messagePickupService = messagePickupService
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
    this.registerListeners()
  }

  public async init(config: { autoAcceptMediationRequests: boolean }) {
    // autoAcceptMediationRequests
    //             "automatically granting to everyone asking, rather than enabling the feature altogether"
    //             "After establishing a connection, "
    //             "if enabled, an agent may request message mediation, which will "
    //             "allow the mediator to forward messages on behalf of the recipient. "
    //             "See aries-rfc:0211."
    //if (config.autoAcceptMediationRequests) {
    //  this.autoAcceptMediationRequests = config.autoAcceptMediationRequests
    //}
  }

  public async grantRequestedMediation(connectionRecord: ConnectionRecord, mediationRecord: MediationRecord) {
    const grantMessage = await this.mediatorService.createGrantMediationMessage(mediationRecord)
    const outboundMessage = createOutboundMessage(connectionRecord, grantMessage)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  public queueMessage(theirKey: string, message: WireMessage) {
    return this.messagePickupService.queueMessage(theirKey, message)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.mediatorService))
    dispatcher.registerHandler(new ForwardHandler(this.mediatorService))
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService))
  }
  private registerListeners() {
    this.eventEmitter.on<MediationKeylistUpdatedEvent>(
      RoutingEventTypes.MediationKeylistUpdated,
      this.keylistUpdatedResponseEvent
    )
    this.eventEmitter.on<MediationGrantedEvent>(RoutingEventTypes.MediationGranted, this.grantRequestedMediation_)
    this.eventEmitter.on(RoutingEventTypes.Forward, async (event: ForwardEvent) => {
      // TODO: Other checks (verKey, theirKey, etc.)
      const connectionRecord: ConnectionRecord = await this.connectionService.getById(event.payload.connectionId)
      const outbound = createOutboundMessage(connectionRecord, event.payload.message)
      await this.messageSender.sendMessage(outbound)
    })

    this.eventEmitter.on(RoutingEventTypes.MediationKeylist, async (event: MediationKeylistEvent) => {
      const connectionRecord: ConnectionRecord = await this.connectionService.getById(
        event.payload.mediationRecord.connectionId
      )
      // TODO: update this to use keylist response instead of updated response
      //const message = await this.mediatorService.createKeylistUpdateResponseMessage(event.payload.keylist)
      //const outbound = createOutboundMessage(connectionRecord, message)
      //await this.messageSender.sendMessage(outbound)
    })
  }
  private keylistUpdatedResponseEvent = async ({payload:{
    mediationRecord,
    message,
    keylist,} }: MediationKeylistUpdatedEvent) => {
    const connectionRecord: ConnectionRecord = await this.connectionService.getById(mediationRecord.connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
  }
  private grantRequestedMediation_ = async ({ payload: { mediationRecord, message } }: MediationGrantedEvent) => {
    const connectionRecord: ConnectionRecord = await this.connectionService.getById(mediationRecord.connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
  }
}
