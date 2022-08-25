import type { DIDCommMessage, DIDCommV2Message } from '../../../agent/didcomm'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Routing } from '../../connections/services'
import type { DidListUpdatedEvent, MediationStateChangedEvent } from '../RoutingEvents'
import type { MediationDenyMessageV2, MediationGrantMessageV2, DidListUpdateResponseMessage } from '../messages'
import type { GetRoutingOptions } from '../types'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { filter, first, timeout } from 'rxjs/operators'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { Wallet } from '../../../wallet'
import { RoutingEventTypes } from '../RoutingEvents'
import { ListUpdateAction, DidListUpdateMessage, MediationRequestMessageV2, DidListUpdate } from '../messages'
import { MediationRole, MediationState } from '../models'
import { MediationRecord, MediationRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class MediationRecipientService {
  private wallet: Wallet
  private mediatorRepository: MediationRepository
  private eventEmitter: EventEmitter
  private messageSender: MessageSender
  private config: AgentConfig

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    messageSender: MessageSender,
    config: AgentConfig,
    mediatorRepository: MediationRepository,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.wallet = wallet
    this.mediatorRepository = mediatorRepository
    this.eventEmitter = eventEmitter
    this.messageSender = messageSender
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

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessageV2>) {
    // Mediation record must already exist to be updated to granted status
    const mediationRecord = await this.getMediationRecord(messageContext)

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Recipient)

    // Update record
    mediationRecord.endpoint = messageContext.message.body.endpoint
    mediationRecord.routingKeys = messageContext.message.body.routingKeys
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

    await this.mediatorRepository.update(mediationRecord)
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
          new DidListUpdate({
            action: ListUpdateAction.add,
            recipientDid: did,
          }),
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

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param mediationRecord The proof record to update the state for
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

  public async findGrantedByMediatorDid(did: string): Promise<MediationRecord | null> {
    return this.mediatorRepository.findSingleByQuery({ mediatorDid: did, state: MediationState.Granted })
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

  private async getMediationRecord(messageContext: InboundMessageContext<DIDCommV2Message>): Promise<MediationRecord> {
    if (!messageContext.message.to || !messageContext.message.to.length) {
      throw new Error(`No mediation has been requested for this did: ${messageContext.message.to}`)
    }
    const mediationRecord = await this.mediatorRepository.getByDid(messageContext.message.to[0])

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
