import { inject, Lifecycle, scoped } from 'tsyringe'
import type { Verkey } from 'indy-sdk'

import {
  KeylistUpdateMessage,
  KeylistUpdate,
  KeylistUpdateAction,
  MediationGrantMessage,
  MediationDenyMessage,
  MediationRequestMessage,
  KeylistUpdateResponseMessage,
} from '../messages'

import { ConnectionRecord } from '../../connections'
import { RoutingEventTypes, MediationKeylistEvent, MediationStateChangedEvent } from '../RoutingEvents'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'

import { assertConnection, createRecord, MediationRecord, MediationRole, MediationState } from '..'
import { Wallet } from '../../../wallet/Wallet'
import { AgentMessage } from '../../../agent/AgentMessage'
import { EventEmitter } from '../../../agent/EventEmitter'
import { Symbols } from '../../../symbols'
import { MediationRepository } from '../repository/MediationRepository'

@scoped(Lifecycle.ContainerScoped)
export class RecipientService {
  private mediatorRepository: MediationRepository
  private defaultMediator?: MediationRecord
  private wallet: Wallet
  private eventEmitter: EventEmitter

  public constructor(
    mediatorRepository: MediationRepository,
    @inject(Symbols.Wallet) wallet: Wallet,
    eventEmitter: EventEmitter
  ) {
    this.mediatorRepository = mediatorRepository
    this.wallet = wallet
    this.eventEmitter = eventEmitter
  }

  public async init() {
    const results = await this.mediatorRepository.findByQuery({ default: 'true' })
    this.defaultMediator = results ? results[0] : this.defaultMediator
    if (this.defaultMediator) {
      // Remove any possible competing mediators set all other record tags' default to false.
      this.setDefaultMediator(this.defaultMediator)
    }
  }

  public async createRequest(connection: ConnectionRecord): Promise<[MediationRecord, MediationRequestMessage]> {
    const mediationRecord = await createRecord(
      {
        connectionId: connection.id,
        role: MediationRole.Mediator,
        state: MediationState.Requested,
      },
      this.mediatorRepository
    )
    return [mediationRecord, new MediationRequestMessage({})]
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    const connection = assertConnection(
      messageContext.connection,
      'No connection associated with incoming mediation grant message'
    )
    // Mediation record must already exists to be updated to granted status
    const mediationRecord = await this.findByConnectionId(connection.id)
    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }
    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertConnection(connection.id)

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint
    mediationRecord.routingKeys = messageContext.message.routingKeys
    await this.updateState(mediationRecord, MediationState.Granted)

    return mediationRecord
  }

  public createKeylistQuery(
    filter?: Map<string, string>,
    paginateLimit?: number | undefined,
    paginateOffset?: number | undefined
  ) {
    //paginateLimit = paginateLimit ?? -1,
    //paginateOffset = paginateOffset ?? 0
    // TODO: Implement this
    //return new MediationKeyListQueryMessage()
    return new AgentMessage()
  }

  public async createKeylistUpdateMessage(verkey?: Verkey): Promise<KeylistUpdateMessage> {
    if (!verkey) {
      let did
      ;[did, verkey] = await this.wallet.createDid()
    }
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

  public async processKeylistUpdateResults(messageContext: InboundMessageContext<KeylistUpdateResponseMessage>) {
    const connection = assertConnection(
      messageContext.connection,
      'No connection associated with incoming mediation keylistUpdateResults message'
    )
    const mediationRecord = await this.findByConnectionId(connection.id)
    if (!mediationRecord) {
      throw new Error(`mediation record for  ${connection.id} not found!`)
    }
    const keylist = messageContext.message.updated
    // TODO: update keylist in mediationRecord...
    // for ...
    // await this.mediatorRepository.update(mediationRecord)
    this.eventEmitter.emit<MediationKeylistEvent>({
      type: RoutingEventTypes.MediationKeylist,
      payload: {
        mediationRecord,
        keylist,
      },
    })
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const connection = assertConnection(
      messageContext.connection,
      'No connection associated with incoming mediation deny message'
    )

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(connection.id)

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertConnection(connection.id)

    // Update record
    await this.updateState(mediationRecord, MediationState.Denied)

    return mediationRecord
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
  }

  public async findById(mediatorId: string): Promise<MediationRecord | null> {
    const record = await this.mediatorRepository.findById(mediatorId)
    return record
    // TODO - Handle errors?
  }

  public async findByConnectionId(id: string): Promise<MediationRecord | null> {
    const records = await this.mediatorRepository.findByQuery({ id })
    return records[0]
  }

  public async getMediators(): Promise<MediationRecord[] | null> {
    return await this.mediatorRepository.getAll()
  }

  public async getDefaultMediatorId(): Promise<string | undefined> {
    if (this.defaultMediator !== undefined) {
      return this.defaultMediator.id
    }
    const record = await this.getDefaultMediator()
    return record ? record.id : undefined
  }

  public async getDefaultMediator() {
    if (this.defaultMediator === undefined) {
      const results = await this.mediatorRepository.findByQuery({ default: 'true' })
      if (results[0]) {
        this.setDefaultMediator(results[0])
      }
    }
    return this.defaultMediator
  }

  public async setDefaultMediator(mediator: MediationRecord) {
    // Get list of all mediator records. For each record, update default all others to false.
    // let fetchedRecords: MediationRecord[]
    const fetchedRecords = (await this.getMediators()) ?? []

    fetchedRecords.forEach(this.updateDefault)
    // Set record coming in tag to true and then update.
    mediator.tags['default'] = 'true'
    this.mediatorRepository.save(mediator)
    this.defaultMediator = mediator
  }

  public async clearDefaultMediator() {
    const fetchedRecords = (await this.getMediators()) ?? []
    fetchedRecords.forEach(this.updateDefault)
    delete this.defaultMediator
  }

  private updateDefault(record: MediationRecord) {
    record.tags['default'] = 'false'
    this.mediatorRepository.save(record)
    return record
  }
}
