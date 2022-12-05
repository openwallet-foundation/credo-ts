import type { AgentContext } from '../../../../../agent'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommV2Message } from '../../../../../didcomm'
import type { ConnectionRecord } from '../../../../connections'
import type { DidlistUpdatedEvent, MediationStateChangedEvent } from '../../../RoutingEvents'
import type { KeyListUpdateResponseMessage, MediationDenyMessage, MediationGrantMessage } from './messages'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { filter, first, timeout } from 'rxjs/operators'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { MessageSender } from '../../../../../agent/MessageSender'
import { OutboundMessageContext } from '../../../../../agent/models'
import { injectable } from '../../../../../plugins'
import { ConnectionService } from '../../../../connections/services/ConnectionService'
import { DidResolverService } from '../../../../dids/services/DidResolverService'
import { MediatorPickupStrategy } from '../../../MediatorPickupStrategy'
import { RecipientModuleConfig } from '../../../RecipientModuleConfig'
import { RoutingEventTypes } from '../../../RoutingEvents'
import { MediationRole, MediationState } from '../../../models'
import { MediationRecord } from '../../../repository/MediationRecord'
import { MediationRepository } from '../../../repository/MediationRepository'
import { StatusRequestMessage } from '../../pickup/v2/messages'
import { MediationRecipientSharedService } from '../MediationRecipientSharedService'

import { DidListUpdateResponseHandler, MediationDenyHandler, MediationGrantHandler } from './handlers'
import { KeyListUpdateMessage, MediationRequestMessage } from './messages'
import { ListUpdateAction } from './messages/ListUpdateAction'

@injectable()
export class V2MediationRecipientService extends MediationRecipientSharedService {
  private didResolverService!: DidResolverService

  public constructor(
    messageSender: MessageSender,
    mediatorRepository: MediationRepository,
    eventEmitter: EventEmitter,
    connectionService: ConnectionService,
    didResolverService: DidResolverService,
    recipientModuleConfig: RecipientModuleConfig,
    dispatcher: Dispatcher
  ) {
    super(connectionService, messageSender, mediatorRepository, eventEmitter, dispatcher, recipientModuleConfig)
    this.didResolverService = didResolverService

    this.registerHandlers()
  }

  public async createStatusRequest(
    mediationRecord: MediationRecord,
    config: {
      recipientKey?: string
    } = {}
  ) {
    mediationRecord.assertRole(MediationRole.Recipient)
    mediationRecord.assertReady()

    const { recipientKey } = config
    const statusRequest = new StatusRequestMessage({
      recipientKey,
    })

    return statusRequest
  }

  public async createRequest(
    agentContext: AgentContext,
    connection: ConnectionRecord
  ): Promise<MediationProtocolMsgReturnType<MediationRequestMessage>> {
    const message = new MediationRequestMessage({
      from: connection.did,
      to: connection.theirDid,
      body: {
        deliveryType:
          this.recipientModuleConfig.mediatorPickupStrategy === MediatorPickupStrategy.Implicit
            ? 'WebSocket'
            : undefined,
        deliveryData:
          this.recipientModuleConfig.mediatorPushToken ||
          this.recipientModuleConfig.mediatorWebHookEndpoint ||
          undefined,
      },
    })

    const mediationRecord = new MediationRecord({
      threadId: message.id,
      state: MediationState.Requested,
      role: MediationRole.Recipient,
      connectionId: connection.id,
    })
    await this.mediationRepository.save(agentContext, mediationRecord)
    this.eventEmitter.emit<MediationStateChangedEvent>(agentContext, {
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord,
        previousState: null,
      },
    })

    return { mediationRecord, message }
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    // Mediation record must already exist to be updated to granted status
    const mediationRecord = await this.getMediator(messageContext.agentContext, messageContext.message.from)
    if (!mediationRecord) return

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Recipient)

    // Update record
    const didDocument = await this.didResolverService.resolve(
      messageContext.agentContext,
      messageContext.message.body.routingDid[0]
    )
    if (!didDocument.didDocument?.service?.length) {
      return
    }

    mediationRecord.routingKeys = messageContext.message.body.routingDid
    mediationRecord.endpoint = didDocument.didDocument?.service[0]?.serviceEndpoint

    return await this.updateState(messageContext.agentContext, mediationRecord, MediationState.Granted)
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const mediationRecord = await this.getMediator(messageContext.agentContext, messageContext.message.from)
    if (!mediationRecord) return

    // Assert
    mediationRecord.assertRole(MediationRole.Recipient)
    mediationRecord.assertState(MediationState.Requested)

    // Update record
    await this.updateState(messageContext.agentContext, mediationRecord, MediationState.Denied)

    return mediationRecord
  }

  public async processDidListUpdateResults(messageContext: InboundMessageContext<KeyListUpdateResponseMessage>) {
    const mediationRecord = await this.getMediator(messageContext.agentContext, messageContext.message.from)
    if (!mediationRecord) return

    // Assert
    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

    const didlist = messageContext.message.body.updated

    // update keylist in mediationRecord
    for (const update of didlist) {
      if (update.action === ListUpdateAction.add) {
        mediationRecord.addRecipientKey(update.recipientDid)
      } else if (update.action === ListUpdateAction.remove) {
        mediationRecord.removeRecipientKey(update.recipientDid)
      }
    }

    await this.mediationRepository.update(messageContext.agentContext, mediationRecord)
    this.eventEmitter.emit<DidlistUpdatedEvent>(messageContext.agentContext, {
      type: RoutingEventTypes.RecipientDidlistUpdated,
      payload: {
        mediationRecord,
        didlist,
      },
    })
  }

  public async didListUpdateAndAwait(
    agentContext: AgentContext,
    mediationRecord: MediationRecord,
    did: string,
    timeoutMs = 15000 // TODO: this should be a configurable value in agent config
  ): Promise<MediationRecord> {
    const connection = await this.connectionService.getById(agentContext, mediationRecord.connectionId)

    const message = this.createDidlistUpdateMessage(connection, did)

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

    // Create observable for event
    const observable = this.eventEmitter.observable<DidlistUpdatedEvent>(RoutingEventTypes.RecipientDidlistUpdated)
    const subject = new ReplaySubject<DidlistUpdatedEvent>(1)

    // Apply required filters to observable stream and create promise to subscribe to observable
    observable
      .pipe(
        // Only take event for current mediation record
        filter((event) => mediationRecord.id === event.payload.mediationRecord.id),
        // Only wait for first event that matches the criteria
        first(),
        // Do not wait for longer than specified timeout
        timeout(timeoutMs)
      )
      .subscribe(subject)

    const payload = new OutboundMessageContext(message, {
      agentContext,
      connection,
    })
    await this.messageSender.sendMessage(payload)

    const keylistUpdate = await firstValueFrom(subject)
    return keylistUpdate.payload.mediationRecord
  }

  public createDidlistUpdateMessage(connection: ConnectionRecord, did: string): KeyListUpdateMessage {
    const didlistUpdateMessage = new KeyListUpdateMessage({
      from: connection.did,
      to: connection.theirDid,
      body: {
        updates: [
          {
            action: ListUpdateAction.add,
            recipientDid: did,
          },
        ],
      },
    })
    return didlistUpdateMessage
  }

  public async getMediator(agentContext: AgentContext, from?: string): Promise<MediationRecord | undefined> {
    if (!from) return undefined

    const connection = await this.connectionService.findByTheirDid(agentContext, from)
    if (!connection) return undefined

    return this.mediationRepository.getByConnectionId(agentContext, connection.id)
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new DidListUpdateResponseHandler(this))
    this.dispatcher.registerHandler(new MediationDenyHandler(this))
    this.dispatcher.registerHandler(new MediationGrantHandler(this))
  }
}

export interface MediationProtocolMsgReturnType<MessageType extends DidCommV2Message> {
  message: MessageType
  mediationRecord: MediationRecord
}
