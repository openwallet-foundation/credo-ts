import { Lifecycle, scoped } from 'tsyringe'
import type { Verkey } from 'indy-sdk'

import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { Dispatcher } from '../../agent/Dispatcher'
import { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import { KeylistUpdateHandler, ForwardHandler, BatchPickupHandler, BatchHandler } from './handlers'
import { MediatorService } from './services/MediatorService'
import { MessagePickupService } from './services/MessagePickupService'
import { ConnectionService } from '../connections'
import { MediationRecord } from '.'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { EventEmitter } from '../../agent/EventEmitter'

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
  }

  public async init() {
    // autoAcceptMediationRequests
    //             "automatically granting to everyone asking, rather than enabling the feature altogether"
    //             "After establishing a connection, "
    //             "if enabled, an agent may request message mediation, which will "
    //             "allow the mediator to forward messages on behalf of the recipient. "
    //             "See aries-rfc:0211."
  }

  public async grantRequestedMediation(connectionRecord: ConnectionRecord, mediationRecord: MediationRecord) {
    const grantMessage = await this.mediatorService.createGrantMediationMessage(mediationRecord)
    const outboundMessage = createOutboundMessage(connectionRecord, grantMessage)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  // TODO - Belongs in connections.
  public async acceptRequest(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createResponse(connectionId)

    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)

    return connectionRecord
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.mediatorService))
    dispatcher.registerHandler(new ForwardHandler(this.mediatorService))
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService))
  }
}

interface MediatorConfiguration {
  verkey: Verkey
  invitationUrl: string
  alias?: string
}
