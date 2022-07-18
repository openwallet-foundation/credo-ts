import type { EncryptedMessage } from '../../agent/didcomm/types'
import type { MediationRecord } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ConnectionService } from '../connections/services'

import { KeylistUpdateHandler, ForwardHandler, BatchPickupHandler, BatchHandler } from './handlers'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { MediatorService } from './services/MediatorService'
import { MessagePickupService } from './services/MessagePickupService'

@scoped(Lifecycle.ContainerScoped)
export class MediatorModule {
  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  public eventEmitter: EventEmitter
  public agentConfig: AgentConfig
  public connectionService: ConnectionService

  public constructor(
    dispatcher: Dispatcher,
    mediationService: MediatorService,
    messagePickupService: MessagePickupService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    agentConfig: AgentConfig,
    connectionService: ConnectionService
  ) {
    this.mediatorService = mediationService
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.registerHandlers(dispatcher)
  }

  public async grantRequestedMediation(mediatorId: string): Promise<MediationRecord> {
    const record = await this.mediatorService.getById(mediatorId)
    const connectionRecord = await this.connectionService.getById(record.did)

    const { message, mediationRecord } = await this.mediatorService.createGrantMediationMessage(record)
    const outboundMessage = createOutboundMessage(connectionRecord, message)

    await this.messageSender.sendDIDCommV1Message(outboundMessage)

    return mediationRecord
  }

  public queueMessage(connectionId: string, message: EncryptedMessage) {
    return this.messagePickupService.queueMessage(connectionId, message)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.mediatorService, this.messageSender))
    dispatcher.registerHandler(new ForwardHandler(this.mediatorService, this.connectionService, this.messageSender))
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService, this.messageSender))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService, this.agentConfig, this.messageSender))
  }
}
