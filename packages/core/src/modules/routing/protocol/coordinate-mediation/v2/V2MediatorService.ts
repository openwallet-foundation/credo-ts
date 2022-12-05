import type { AgentContext } from '../../../../../agent'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { MediationRequestMessage, KeyListUpdateMessage } from './messages'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { MessageSender } from '../../../../../agent/MessageSender'
import { InjectionSymbols } from '../../../../../constants'
import { Logger } from '../../../../../logger'
import { injectable, inject } from '../../../../../plugins'
import { DidExchangeRole, DidExchangeState, HandshakeProtocol } from '../../../../connections/models'
import { ConnectionService } from '../../../../connections/services/ConnectionService'
import { MediatorModuleConfig } from '../../../MediatorModuleConfig'
import { MediationRole } from '../../../models/MediationRole'
import { MediationState } from '../../../models/MediationState'
import { MediationRecord } from '../../../repository/MediationRecord'
import { MediationRepository } from '../../../repository/MediationRepository'
import { MediatorRoutingRepository } from '../../../repository/MediatorRoutingRepository'
import { MediatorSharedService } from '../MediatorSharedService'

import { DidListUpdateHandler, MediationRequestHandler } from './handlers'
import { DidListUpdated, KeyListUpdateResponseMessage, MediationGrantMessage } from './messages'
import { ListUpdateAction, ListUpdateResult } from './messages/ListUpdateAction'

@injectable()
export class V2MediatorService extends MediatorSharedService {
  public constructor(
    mediationRepository: MediationRepository,
    connectionService: ConnectionService,
    mediatorSharedService: MediatorSharedService,
    mediatorRoutingRepository: MediatorRoutingRepository,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.Logger) logger: Logger,
    messageSender: MessageSender,
    dispatcher: Dispatcher,
    mediatorModuleConfig: MediatorModuleConfig
  ) {
    super(
      mediationRepository,
      connectionService,
      mediatorRoutingRepository,
      eventEmitter,
      logger,
      messageSender,
      dispatcher,
      mediatorModuleConfig
    )

    this.registerHandlers()
  }

  public async processDidListUpdateRequest(messageContext: InboundMessageContext<KeyListUpdateMessage>) {
    const { message } = messageContext
    const didList: DidListUpdated[] = []

    const mediationRecord = await this.getMediator(messageContext.agentContext, message.from)
    if (!mediationRecord) return

    const mediatorConnection = await this.connectionService.getById(
      messageContext.agentContext,
      mediationRecord.connectionId
    )

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Mediator)

    for (const update of message.body.updates) {
      const updated = new DidListUpdated({
        action: update.action,
        recipientDid: update.recipientDid,
        result: ListUpdateResult.NoChange,
      })
      if (update.action === ListUpdateAction.add) {
        mediationRecord.addRecipientKey(update.recipientDid)
        updated.result = ListUpdateResult.Success

        didList.push(updated)
      } else if (update.action === ListUpdateAction.remove) {
        const success = mediationRecord.removeRecipientKey(update.recipientDid)
        updated.result = success ? ListUpdateResult.Success : ListUpdateResult.NoChange
        didList.push(updated)
      }
    }

    await this.mediationRepository.update(messageContext.agentContext, mediationRecord)

    return new KeyListUpdateResponseMessage({
      from: mediatorConnection.did,
      body: { updated: didList },
    })
  }

  public async createGrantMediationMessage(agentContext: AgentContext, mediationRecord: MediationRecord) {
    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Mediator)

    const mediatorConnection = await this.connectionService.getById(agentContext, mediationRecord.connectionId)

    await this.updateState(agentContext, mediationRecord, MediationState.Granted)

    const message = new MediationGrantMessage({
      from: mediatorConnection.did,
      body: {
        routingDid: await this.getRoutingKeys(agentContext),
      },
    })

    return { mediationRecord, message }
  }

  public async processMediationRequest(messageContext: InboundMessageContext<MediationRequestMessage>) {
    if (!messageContext.message.from || !messageContext.message.to?.length) return

    const connectionRecord = await this.connectionService.createConnection(messageContext.agentContext, {
      protocol: HandshakeProtocol.V2DidExchange,
      role: DidExchangeRole.Requester,
      state: DidExchangeState.Completed,
      theirDid: messageContext.message.from,
      did: messageContext.message.to[0],
    })

    const mediationRecord = new MediationRecord({
      role: MediationRole.Mediator,
      state: MediationState.Requested,
      threadId: messageContext.message.threadId || messageContext.message.id,
      connectionId: connectionRecord.id,
    })

    await this.mediationRepository.save(messageContext.agentContext, mediationRecord)
    this.emitStateChangedEvent(messageContext.agentContext, mediationRecord, null)

    return mediationRecord
  }

  private async getMediator(agentContext: AgentContext, from?: string): Promise<MediationRecord | undefined> {
    if (!from) return undefined

    const connection = await this.connectionService.findByTheirDid(agentContext, from)
    if (!connection) return undefined

    return this.mediationRepository.getByConnectionId(agentContext, connection.id)
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new DidListUpdateHandler(this, this.messageSender))
    this.dispatcher.registerHandler(new MediationRequestHandler(this, this.mediatorModuleConfig, this.messageSender))
  }
}
