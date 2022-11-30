import type { AgentMessageReceivedEvent } from '../../../agent/Events'
import type { DIDCommMessage, DIDCommV2Message } from '../../../agent/didcomm'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../types'
import type { ConnectionRecord } from '../../connections'
import type { Routing } from '../../connections/services/ConnectionService'
import type { GetRoutingOptions } from '../../routing'
import type { DidListUpdatedEvent, MediationStateChangedEvent } from '../RoutingEvents'
import type { MediationDenyMessageV2, MediationGrantMessageV2, DidListUpdateResponseMessage } from '../messages'
import type { StatusMessage, MessageDeliveryMessage } from '../protocol'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { filter, first, timeout } from 'rxjs/operators'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AgentEventTypes } from '../../../agent/Events'
import { MessageSender } from '../../../agent/MessageSender'
import { createOutboundMessage } from '../../../agent/helpers'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { inject, injectable } from '../../../plugins'
import { JsonTransformer } from '../../../utils'
import { Wallet } from '../../../wallet'
import { ConnectionMetadataKeys } from '../../connections/repository/ConnectionMetadataTypes'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DidResolverService } from '../../dids/services/DidResolverService'
import { ProblemReportError } from '../../problem-reports'
import { RoutingEventTypes } from '../RoutingEvents'
import { RoutingProblemReportReason } from '../error'
import { ListUpdateAction, DidListUpdateMessage, MediationRequestMessageV2 } from '../messages'
import { MediationRole, MediationState } from '../models'
import { DeliveryRequestMessage, MessagesReceivedMessage, StatusRequestMessage } from '../protocol/pickup/v2/messages'
import { MediationRecord } from '../repository/MediationRecord'
import { MediationRepository } from '../repository/MediationRepository'

@injectable()
export class MediationRecipientService {
  private wallet: Wallet
  private mediationRepository: MediationRepository
  private eventEmitter: EventEmitter
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private config: AgentConfig
  private didResolverService: DidResolverService

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    config: AgentConfig,
    mediatorRepository: MediationRepository,
    eventEmitter: EventEmitter,
    didResolverService: DidResolverService
  ) {
    this.wallet = wallet
    this.config = config
    this.mediationRepository = mediatorRepository
    this.eventEmitter = eventEmitter
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.didResolverService = didResolverService
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
    did: string,
    mediatorDid: string
  ): Promise<MediationProtocolMsgReturnType<MediationRequestMessageV2>> {
    const message = new MediationRequestMessageV2({
      from: did,
      to: mediatorDid,
      body: {
        deliveryType: this.config.mediatorDeliveryStrategy,
        deliveryData: this.config.mediatorPushToken || this.config.mediatorWebHookEndpoint || undefined,
      },
    })

    const mediationRecord = new MediationRecord({
      threadId: message.id,
      state: MediationState.Requested,
      role: MediationRole.Recipient,
      did,
      mediatorDid,
    })
    await this.mediationRepository.save(mediationRecord)
    this.eventEmitter.emit<MediationStateChangedEvent>({
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord,
        previousState: null,
      },
    })

    return { mediationRecord, message }
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessageV2>) {
    // Mediation record must already exist to be updated to granted status
    const mediationRecord = await this.getMediationRecord(messageContext)

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Recipient)

    // Update record
    const didDocument = await this.didResolverService.resolve(messageContext.message.body.routingDid[0])
    if (!didDocument.didDocument?.service?.length) {
      return
    }
    mediationRecord.routingKeys = messageContext.message.body.routingDid
    mediationRecord.endpoint = didDocument.didDocument?.service[0]?.serviceEndpoint
    return await this.updateState(mediationRecord, MediationState.Granted)
  }

  public async processDidListUpdateResults(messageContext: InboundMessageContext<DidListUpdateResponseMessage>) {
    // Mediation record must already exist to be updated
    const mediationRecord = await this.getMediationRecord(messageContext)

    // Assert
    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

    const didList = messageContext.message.body.updated

    // update keylist in mediationRecord
    for (const update of didList) {
      if (update.action === ListUpdateAction.add) {
        mediationRecord.addRecipientKey(update.recipientDid)
      } else if (update.action === ListUpdateAction.remove) {
        mediationRecord.removeRecipientKey(update.recipientDid)
      }
    }

    await this.mediationRepository.update(mediationRecord)
    this.eventEmitter.emit<DidListUpdatedEvent>({
      type: RoutingEventTypes.RecipientDidListUpdated,
      payload: {
        mediationRecord,
        didList,
      },
    })
  }

  public async didListUpdateAndAwait(
    mediationRecord: MediationRecord,
    did: string,
    timeoutMs = 15000 // TODO: this should be a configurable value in agent config
  ): Promise<MediationRecord> {
    const message = this.createKeylistUpdateMessage(mediationRecord, did)

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

    // Create observable for event
    const observable = this.eventEmitter.observable<DidListUpdatedEvent>(RoutingEventTypes.RecipientDidListUpdated)
    const subject = new ReplaySubject<DidListUpdatedEvent>(1)

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

    await this.messageSender.sendDIDCommV2Message(message)

    const keylistUpdate = await firstValueFrom(subject)
    return keylistUpdate.payload.mediationRecord
  }

  public createKeylistUpdateMessage(mediationRecord: MediationRecord, did: string): DidListUpdateMessage {
    const keylistUpdateMessage = new DidListUpdateMessage({
      from: mediationRecord.did,
      to: mediationRecord.mediatorDid,
      body: {
        updates: [
          {
            action: ListUpdateAction.add,
            recipientDid: did,
          },
        ],
      },
    })
    return keylistUpdateMessage
  }

  public async getRoutingDid({ mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}): Promise<Routing> {
    // Create and store new key
    const { did, verkey } = await this.wallet.createDid()
    const routing = await this.getRouting(verkey, { mediatorId, useDefaultMediator })
    return {
      ...routing,
      did,
      verkey,
    }
  }

  public async getRouting(
    did: string,
    { mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}
  ): Promise<Routing> {
    let mediationRecord: MediationRecord | null = null

    if (mediatorId) {
      mediationRecord = await this.getById(mediatorId)
    } else if (useDefaultMediator) {
      // If no mediatorId is provided, and useDefaultMediator is true (default)
      // We use the default mediator if available
      mediationRecord = await this.findDefaultMediator()
    }

    if (!mediationRecord) {
      throw new AriesFrameworkError(`Mediator not found`)
    }

    // Create and store new key
    // new did has been created and mediator needs to be updated with the public key.
    mediationRecord = await this.didListUpdateAndAwait(mediationRecord, did)

    return {
      endpoint: mediationRecord.endpoint || '',
      routingKeys: mediationRecord.routingKeys,
      mediatorId: mediationRecord?.id,
      did: '',
      verkey: '',
    }
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessageV2>) {
    const mediationRecord = await this.getMediationRecord(messageContext)

    // Assert
    mediationRecord.assertRole(MediationRole.Recipient)
    mediationRecord.assertState(MediationState.Requested)

    // Update record
    await this.updateState(mediationRecord, MediationState.Denied)

    return mediationRecord
  }

  public async processStatus(messageContext: InboundMessageContext<StatusMessage>) {
    const connection = messageContext.assertReadyConnection()
    const { message: statusMessage } = messageContext
    const { messageCount, recipientKey } = statusMessage

    //No messages to be sent
    if (messageCount === 0) {
      const { message, connectionRecord } = await this.connectionService.createTrustPing(connection, {
        responseRequested: false,
      })
      const websocketSchemes = ['ws', 'wss']

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

      return null
    }
    const { maximumMessagePickup } = this.config
    const limit = messageCount < maximumMessagePickup ? messageCount : maximumMessagePickup

    const deliveryRequestMessage = new DeliveryRequestMessage({
      limit,
      recipientKey,
    })

    return deliveryRequestMessage
  }

  public async processDelivery(messageContext: InboundMessageContext<MessageDeliveryMessage>) {
    messageContext.assertReadyConnection()

    const { appendedAttachments } = messageContext.message

    if (!appendedAttachments)
      throw new ProblemReportError('Error processing attachments', {
        problemCode: RoutingProblemReportReason.ErrorProcessingAttachments,
      })

    const ids: string[] = []
    for (const attachment of appendedAttachments) {
      ids.push(attachment.id)

      this.eventEmitter.emit<AgentMessageReceivedEvent>({
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: attachment.getDataAsJson<EncryptedMessage>(),
        },
      })
    }

    return new MessagesReceivedMessage({
      messageIdList: ids,
    })
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param MediationRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  private async updateState(mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state
    mediationRecord.state = newState
    await this.mediationRepository.update(mediationRecord)

    this.emitStateChangedEvent(mediationRecord, previousState)
    return mediationRecord
  }

  private emitStateChangedEvent(mediationRecord: MediationRecord, previousState: MediationState | null) {
    const clonedMediationRecord = JsonTransformer.clone(mediationRecord)
    this.eventEmitter.emit<MediationStateChangedEvent>({
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord: clonedMediationRecord,
        previousState,
      },
    })
  }

  public async getById(id: string): Promise<MediationRecord> {
    return this.mediationRepository.getById(id)
  }

  public async findGrantedByMediatorDid(did: string): Promise<MediationRecord | null> {
    return this.mediationRepository.findSingleByQuery({ mediatorDid: did, state: MediationState.Granted })
  }

  public async getMediators(): Promise<MediationRecord[]> {
    return this.mediationRepository.getAll()
  }

  public async findDefaultMediator(): Promise<MediationRecord | null> {
    return this.mediationRepository.findSingleByQuery({ default: true })
  }

  public async discoverMediation(mediatorId?: string): Promise<MediationRecord | undefined> {
    // If mediatorId is passed, always use it (and error if it is not found)
    if (mediatorId) {
      return this.mediationRepository.getById(mediatorId)
    }

    const defaultMediator = await this.findDefaultMediator()
    if (defaultMediator) {
      if (defaultMediator.state !== MediationState.Granted) {
        throw new AriesFrameworkError(
          `Mediation State for ${defaultMediator.id} is not granted, but is set as default mediator!`
        )
      }

      return defaultMediator
    }
  }

  public async setDefaultMediator(mediator: MediationRecord) {
    const mediationRecords = await this.mediationRepository.findByQuery({ default: true })

    for (const record of mediationRecords) {
      record.setTag('default', false)
      await this.mediationRepository.update(record)
    }

    // Set record coming in tag to true and then update.
    mediator.setTag('default', true)
    await this.mediationRepository.update(mediator)
  }

  public async clearDefaultMediator() {
    const mediationRecord = await this.findDefaultMediator()

    if (mediationRecord) {
      mediationRecord.setTag('default', false)
      await this.mediationRepository.update(mediationRecord)
    }
  }

  private async updateUseDidKeysFlag(connection: ConnectionRecord, protocolUri: string, connectionUsesDidKey: boolean) {
    const useDidKeysForProtocol = connection.metadata.get(ConnectionMetadataKeys.UseDidKeysForProtocol) ?? {}
    useDidKeysForProtocol[protocolUri] = connectionUsesDidKey
    connection.metadata.set(ConnectionMetadataKeys.UseDidKeysForProtocol, useDidKeysForProtocol)
    await this.connectionService.update(connection)
  }

  private async getMediationRecord(messageContext: InboundMessageContext<DIDCommV2Message>): Promise<MediationRecord> {
    if (!messageContext.message.to || !messageContext.message.to.length) {
      throw new Error(`No mediation has been requested for this did: ${messageContext.message.to}`)
    }
    const mediationRecord = await this.mediationRepository.getByDid(messageContext.message.to[0])

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${messageContext.message.from}`)
    }
    return mediationRecord
  }
}

export interface MediationProtocolMsgReturnType<MessageType extends DIDCommMessage> {
  message: MessageType
  mediationRecord: MediationRecord
}
