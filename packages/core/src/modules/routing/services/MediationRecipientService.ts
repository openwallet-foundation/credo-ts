import type { AgentMessage } from '../../../agent/AgentMessage'
import type { AgentMessageReceivedEvent } from '../../../agent/Events'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../types'
import type { ConnectionRecord } from '../../connections'
import type { Routing } from '../../connections/services/ConnectionService'
import type { MediationStateChangedEvent, KeylistUpdatedEvent } from '../RoutingEvents'
import type {
  KeylistUpdateResponseMessage,
  MediationDenyMessage,
  MediationGrantMessage,
  MessageDeliveryMessage,
} from '../messages'
import type { StatusMessage } from '../messages/StatusMessage'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { filter, first, timeout } from 'rxjs/operators'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AgentEventTypes } from '../../../agent/Events'
import { MessageSender } from '../../../agent/MessageSender'
import { createOutboundMessage } from '../../../agent/helpers'
import { InjectionSymbols } from '../../../constants'
import { KeyType } from '../../../crypto'
import { AriesFrameworkError } from '../../../error'
import { Wallet } from '../../../wallet/Wallet'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { Key } from '../../dids'
import { ProblemReportError } from '../../problem-reports'
import { RoutingEventTypes } from '../RoutingEvents'
import { RoutingProblemReportReason } from '../error'
import {
  StatusRequestMessage,
  DeliveryRequestMessage,
  MessagesReceivedMessage,
  KeylistUpdateAction,
  MediationRequestMessage,
} from '../messages'
import { KeylistUpdate, KeylistUpdateMessage } from '../messages/KeylistUpdateMessage'
import { MediationRole, MediationState } from '../models'
import { MediationRecord } from '../repository/MediationRecord'
import { MediationRepository } from '../repository/MediationRepository'

@scoped(Lifecycle.ContainerScoped)
export class MediationRecipientService {
  private wallet: Wallet
  private mediationRepository: MediationRepository
  private eventEmitter: EventEmitter
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private config: AgentConfig
  private logger: Logger
  private messageReceiver: MessageReceiver

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    config: AgentConfig,
    mediatorRepository: MediationRepository,
    eventEmitter: EventEmitter,
    messageReveiver: MessageReceiver
  ) {
    this.config = config
    this.wallet = wallet
    this.mediationRepository = mediatorRepository
    this.eventEmitter = eventEmitter
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.logger = config.logger
    this.messageReceiver = messageReveiver
  }

  public async requestStatus(
    config: {
      mediatorId?: string
      recipientKey?: string
    } = {}
  ) {
    let mediator
    let mediatorRecord

    if (config.mediatorId) {
      const record = await this.getById(config.mediatorId)
      mediator = await this.connectionService.findById(record.id)
    } else {
      mediatorRecord = await this.findDefaultMediator()
      if (mediatorRecord) mediator = await this.connectionService.getById(mediatorRecord.connectionId)
    }

    const { recipientKey } = config
    const statusRequest = new StatusRequestMessage({
      recipientKey,
    })
    if (!mediator) throw new AriesFrameworkError('Could not find mediator connection')
    return this.messageSender.sendMessage(createOutboundMessage(mediator, statusRequest))
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
    connection: ConnectionRecord
  ): Promise<MediationProtocolMsgReturnType<MediationRequestMessage>> {
    const message = new MediationRequestMessage({})

    const mediationRecord = new MediationRecord({
      threadId: message.threadId,
      state: MediationState.Requested,
      role: MediationRole.Recipient,
      connectionId: connection.id,
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

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    // Mediation record must already exists to be updated to granted status
    const mediationRecord = await this.mediationRepository.getByConnectionId(connection.id)

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Recipient)

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint
    mediationRecord.routingKeys = messageContext.message.routingKeys
    return await this.updateState(mediationRecord, MediationState.Granted)
  }

  public async processKeylistUpdateResults(messageContext: InboundMessageContext<KeylistUpdateResponseMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = await this.mediationRepository.getByConnectionId(connection.id)

    // Assert
    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

    const keylist = messageContext.message.updated

    // update keylist in mediationRecord
    for (const update of keylist) {
      if (update.action === KeylistUpdateAction.add) {
        mediationRecord.addRecipientKey(update.recipientKey)
      } else if (update.action === KeylistUpdateAction.remove) {
        mediationRecord.removeRecipientKey(update.recipientKey)
      }
    }

    await this.mediationRepository.update(mediationRecord)
    this.eventEmitter.emit<KeylistUpdatedEvent>({
      type: RoutingEventTypes.RecipientKeylistUpdated,
      payload: {
        mediationRecord,
        keylist,
      },
    })
  }

  public async keylistUpdateAndAwait(
    mediationRecord: MediationRecord,
    verKey: string,
    timeoutMs = 15000 // TODO: this should be a configurable value in agent config
  ): Promise<MediationRecord> {
    const message = this.createKeylistUpdateMessage(verKey)
    const connection = await this.connectionService.getById(mediationRecord.connectionId)

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

    // Create observable for event
    const observable = this.eventEmitter.observable<KeylistUpdatedEvent>(RoutingEventTypes.RecipientKeylistUpdated)
    const subject = new ReplaySubject<KeylistUpdatedEvent>(1)

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

    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    const keylistUpdate = await firstValueFrom(subject)
    return keylistUpdate.payload.mediationRecord
  }

  public createKeylistUpdateMessage(verkey: string): KeylistUpdateMessage {
    const keylistUpdateMessage = new KeylistUpdateMessage({
      updates: [
        new KeylistUpdate({
          action: KeylistUpdateAction.add,
          recipientKey: verkey,
        }),
      ],
    })
    return keylistUpdateMessage
  }

  public async getRouting({ mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}): Promise<Routing> {
    let mediationRecord: MediationRecord | null = null

    if (mediatorId) {
      mediationRecord = await this.getById(mediatorId)
    } else if (useDefaultMediator) {
      // If no mediatorId is provided, and useDefaultMediator is true (default)
      // We use the default mediator if available
      mediationRecord = await this.findDefaultMediator()
    }

    let endpoints = this.config.endpoints
    let routingKeys: Key[] = []

    // Create and store new key
    const { verkey } = await this.wallet.createDid()

    const recipientKey = Key.fromPublicKeyBase58(verkey, KeyType.Ed25519)
    if (mediationRecord) {
      routingKeys = mediationRecord.routingKeys.map((key) => Key.fromPublicKeyBase58(key, KeyType.Ed25519))
      endpoints = mediationRecord.endpoint ? [mediationRecord.endpoint] : endpoints
      // new did has been created and mediator needs to be updated with the public key.
      mediationRecord = await this.keylistUpdateAndAwait(mediationRecord, verkey)
    }

    return { endpoints, routingKeys, recipientKey, mediatorId: mediationRecord?.id }
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const connection = messageContext.assertReadyConnection()

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(connection.id)

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

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

    const mediationRecord = await this.mediationRepository.getByConnectionId(connection.id)

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

    //No messages to be sent
    if (messageCount === 0) {
      const { message, connectionRecord } = await this.connectionService.createTrustPing(connection, {
        responseRequested: false,
      })
      const websocketSchemes = ['ws', 'wss']

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
    const connection = messageContext.assertReadyConnection()

    const { appendedAttachments } = messageContext.message

    const mediationRecord = await this.mediationRepository.getByConnectionId(connection.id)

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

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

    this.eventEmitter.emit<MediationStateChangedEvent>({
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord,
        previousState,
      },
    })
    return mediationRecord
  }

  public async getById(id: string): Promise<MediationRecord> {
    return this.mediationRepository.getById(id)
  }

  public async findByConnectionId(connectionId: string): Promise<MediationRecord | null> {
    return this.mediationRepository.findSingleByQuery({ connectionId })
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
}

export interface MediationProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  mediationRecord: MediationRecord
}

export interface GetRoutingOptions {
  /**
   * Identifier of the mediator to use when setting up routing
   */
  mediatorId?: string

  /**
   * Whether to use the default mediator if available and `mediatorId` has not been provided
   * @default true
   */
  useDefaultMediator?: boolean
}
