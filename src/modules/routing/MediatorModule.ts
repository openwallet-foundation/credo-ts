import { Lifecycle, scoped } from 'tsyringe'

import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { Dispatcher } from '../../agent/Dispatcher'
import { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import { KeylistUpdateHandler, ForwardHandler, BatchPickupHandler, BatchHandler } from './handlers'
import { MediatorService } from './services/MediatorService'
import { MessagePickupService } from './services/MessagePickupService'
import { ConnectionService } from '../connections'
import { MediationGrantedEvent, MediationKeylistUpdatedEvent, RoutingEventTypes } from '.'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { EventEmitter } from '../../agent/EventEmitter'

@scoped(Lifecycle.ContainerScoped)
export class MediatorModule {
  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  public eventEmitter: EventEmitter
  private autoAcceptMediationRequests: boolean = true

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

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.mediatorService))
    dispatcher.registerHandler(new ForwardHandler(this.mediatorService))
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService))
  }
  private registerListeners() {
    this.eventEmitter.on<MediationKeylistUpdatedEvent>(RoutingEventTypes.MediationKeylistUpdated, this.keylistUpdatedResponseEvent)
    this.eventEmitter.on<MediationGrantedEvent>(RoutingEventTypes.MediationGranted, this.grantRequestedMediation)
  }
  private async keylistUpdatedResponseEvent({ payload: { mediationRecord, message } }: MediationKeylistUpdatedEvent) {
    const connectionRecord: ConnectionRecord = await this.connectionService.getById(mediationRecord.connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
  }
  public async grantRequestedMediation({ payload: { mediationRecord, message } }: MediationGrantedEvent) {

    console.log("PUKE: filename: /src/modules/routing/MediatorModule.ts, line: 72"); //PKDBG/Point;
    console.log(this.connectionService);
    const connectionRecord: ConnectionRecord = await this.connectionService.getById(mediationRecord.connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
  }
}