import type { AgentMessage } from '../../../agent/AgentMessage'
import type { MessageReceiver } from '../../../agent/MessageReceiver'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../types'
import type { ConnectionRecord } from '../../connections'
import type { Routing } from '../../connections/services/ConnectionService'
import type { MediationStateChangedEvent, KeylistUpdatedEvent } from '../RoutingEvents'
import type {
  MediationGrantMessage,
  MediationDenyMessage,
  KeylistUpdateResponseMessage,
  MessageDeliveryMessage,
  StatusMessage,
} from '../messages'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { filter, first, timeout } from 'rxjs/operators'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { createOutboundMessage } from '../../../agent/helpers'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { Wallet } from '../../../wallet/Wallet'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { RoutingEventTypes } from '../RoutingEvents'
import {
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
  private mediatorRepository: MediationRepository
  private eventEmitter: EventEmitter
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private config: AgentConfig

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    config: AgentConfig,
    mediatorRepository: MediationRepository,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.wallet = wallet
    this.mediatorRepository = mediatorRepository
    this.eventEmitter = eventEmitter
    this.connectionService = connectionService
    this.messageSender = messageSender
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
    await this.mediatorRepository.save(mediationRecord)
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
    const mediationRecord = await this.mediatorRepository.getByConnectionId(connection.id)

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

    const mediationRecord = await this.mediatorRepository.getByConnectionId(connection.id)

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

    await this.mediatorRepository.update(mediationRecord)
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
    let routingKeys: string[] = []

    // Create and store new key
    const { did, verkey } = await this.wallet.createDid()
    if (mediationRecord) {
      routingKeys = [...routingKeys, ...mediationRecord.routingKeys]
      endpoints = mediationRecord.endpoint ? [mediationRecord.endpoint] : endpoints
      // new did has been created and mediator needs to be updated with the public key.
      mediationRecord = await this.keylistUpdateAndAwait(mediationRecord, verkey)
    } else {
      // TODO: check that recipient keys are in wallet
    }
    return { endpoints, routingKeys, did, verkey, mediatorId: mediationRecord?.id }
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

  public processStatus(statusMessage: StatusMessage) {
    const { messageCount, recipientKey } = statusMessage

    //No messages to be sent
    if (messageCount === 0) return null

    const deliveryRequestMessage = new DeliveryRequestMessage({
      limit: messageCount,
      recipientKey,
    })

    return deliveryRequestMessage
  }

  public async processDelivery(messageDeliveryMessage: MessageDeliveryMessage, messageReceiver: MessageReceiver) {
    const { attachments } = messageDeliveryMessage

    if (!attachments) throw new AriesFrameworkError('No attachments found')

    const ids: string[] = []
    for (const attachment of attachments) {
      await messageReceiver.receiveMessage(attachment.getDataAsJson<EncryptedMessage>())
      ids.push(attachment.id)
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
    await this.mediatorRepository.update(mediationRecord)

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
    return this.mediatorRepository.getById(id)
  }

  public async findByConnectionId(connectionId: string): Promise<MediationRecord | null> {
    return this.mediatorRepository.findSingleByQuery({ connectionId })
  }

  public async getMediators(): Promise<MediationRecord[]> {
    return this.mediatorRepository.getAll()
  }

  public async findDefaultMediator(): Promise<MediationRecord | null> {
    return this.mediatorRepository.findSingleByQuery({ default: true })
  }

  public async discoverMediation(mediatorId?: string): Promise<MediationRecord | undefined> {
    // If mediatorId is passed, always use it (and error if it is not found)
    if (mediatorId) {
      return this.mediatorRepository.getById(mediatorId)
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
    const mediationRecords = await this.mediatorRepository.findByQuery({ default: true })

    for (const record of mediationRecords) {
      record.setTag('default', false)
      await this.mediatorRepository.update(record)
    }

    // Set record coming in tag to true and then update.
    mediator.setTag('default', true)
    await this.mediatorRepository.update(mediator)
  }

  public async clearDefaultMediator() {
    const mediationRecord = await this.findDefaultMediator()

    if (mediationRecord) {
      mediationRecord.setTag('default', false)
      await this.mediatorRepository.update(mediationRecord)
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
