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
  KeylistUpdated,
} from '../messages'

import { ConnectionRecord } from '../../connections'
import { RoutingEventTypes, MediationStateChangedEvent, KeylistUpdatedEvent } from '../RoutingEvents'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'

import { assertConnection, createRecord, KeylistState, MediationRecord, MediationRole, MediationState } from '..'
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
    const records = await this.mediatorRepository.getAll()
    for (let record of records) {
      if (record.default) {
        // Remove any possible competing mediators set all other record tags' default to false.
        this.setDefaultMediator(record)
        return this.defaultMediator
      }
    }
  }

  public async createRequest(connection: ConnectionRecord): Promise<[MediationRecord, MediationRequestMessage]> {
    const mediationRecord = new MediationRecord({
      state: MediationState.Requested,
      role: MediationRole.Mediator,
      connectionId: connection.id,
      tags: {
        role: MediationRole.Mediator,
        connectionId: connection.id,
      },
    })
    await this.mediatorRepository.save(mediationRecord)
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
    return await this.updateState(mediationRecord, MediationState.Granted)
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

    // update keylist in mediationRecord
    for (let update of keylist) {
      if (update.action === KeylistUpdateAction.add) {
        await this.saveRoute(update.recipientKey, mediationRecord)
      } else if (update.action === KeylistUpdateAction.remove) {
        await this.removeRoute(update.recipientKey, mediationRecord)
      }
    }

    this.eventEmitter.emit<KeylistUpdatedEvent>({
      type: RoutingEventTypes.MediationKeylistUpdated,
      payload: {
        mediationRecord,
        keylist,
      },
    })
  }

  public async saveRoute(recipientKey: Verkey, mediationRecord: MediationRecord) {
    mediationRecord.recipientKeys.push(recipientKey)
    this.mediatorRepository.update(mediationRecord)
  }

  public async removeRoute(recipientKey: Verkey, mediationRecord: MediationRecord) {
    const index = mediationRecord.recipientKeys.indexOf(recipientKey, 0)
    if (index > -1) {
      mediationRecord.recipientKeys.splice(index, 1)
    }
    this.mediatorRepository.update(mediationRecord)
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
    return mediationRecord
  }

  public async findById(id: string): Promise<MediationRecord | null> {
    const record = await this.mediatorRepository.findById(id)
    return record
    // TODO - Handle errors?
  }

  public async findByConnectionId(connectionId: string): Promise<MediationRecord | null> {
    const records = await this.mediatorRepository.findByQuery({ connectionId })
    return records[0]
  }

  public async getMediators(): Promise<MediationRecord[] | null> {
    return await this.mediatorRepository.getAll()
  }

  public async getDefaultMediatorId(): Promise<string | undefined> {
    if (this.defaultMediator) {
      return this.defaultMediator.id
    }
    const record = await this.getDefaultMediator()
    return record ? record.id : undefined
  }

  public async getDefaultMediator() {
    if (!this.defaultMediator) {
      const records = await this.mediatorRepository.getAll()
      for (let record of records) {
        if (record.default) {
          this.setDefaultMediator(record)
          return this.defaultMediator
        }
      }
    }
    return this.defaultMediator
  }

  public async setDefaultMediator(mediator: MediationRecord) {
    // Get list of all mediator records. For each record, update default all others to false.
    // let fetchedRecords: MediationRecord[]
    const fetchedRecords = (await this.getMediators()) ?? []

    //fetchedRecords.forEach(this.updateDefault)
    for (let record of fetchedRecords) {
      record.default = false
      await this.mediatorRepository.update(record)
    }
    // Set record coming in tag to true and then update.
    mediator.default = true
    await this.mediatorRepository.update(mediator)
    this.defaultMediator = mediator
    return this.defaultMediator
  }

  public async clearDefaultMediator() {
    const fetchedRecords = (await this.getMediators()) ?? []
    for (let record of fetchedRecords) {
      record.default = false
      await this.mediatorRepository.update(record)
    }
    delete this.defaultMediator
  }
}
