import { Lifecycle, scoped } from 'tsyringe'
import type { Verkey } from 'indy-sdk'
import type { ConnectionRecord } from '../../connections'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { MediationStateChangedEvent } from '../RoutingEvents'
import type { MediationRepository } from '../repository/MediationRepository'
import type { EventEmitter } from '../../../agent/EventEmitter'

import type { MediationGrantMessage, MediationDenyMessage, KeylistUpdateResponseMessage } from '../messages'

import { KeylistUpdateAction, MediationRequestMessage } from '../messages'

import { RoutingEventTypes, KeylistUpdatedEvent } from '../RoutingEvents'
import { assertConnection, MediationRecord, MediationRole, MediationState } from '../index'
import { KeylistMessage } from '../messages/KeylistMessage'

@scoped(Lifecycle.ContainerScoped)
export class RecipientService {
  private mediatorRepository: MediationRepository
  private defaultMediator?: MediationRecord
  private eventEmitter: EventEmitter

  public constructor(mediatorRepository: MediationRepository, eventEmitter: EventEmitter) {
    this.mediatorRepository = mediatorRepository
    this.eventEmitter = eventEmitter
  }

  public async init() {
    const records = await this.mediatorRepository.getAll()
    for (const record of records) {
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
    return new KeylistMessage({})
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
    for (const update of keylist) {
      if (update.action === KeylistUpdateAction.add) {
        await this.saveRoute(update.recipientKey, mediationRecord)
      } else if (update.action === KeylistUpdateAction.remove) {
        await this.removeRoute(update.recipientKey, mediationRecord)
      }
    }
    this.eventEmitter.emit<KeylistUpdatedEvent>({
      type: RoutingEventTypes.RecipientKeylistUpdated,
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
    try {
      const record = await this.mediatorRepository.findById(id)
      return record
    } catch (error) {
      return null
    }
    // TODO - Handle errors?
  }

  public async findByConnectionId(connectionId: string): Promise<MediationRecord | null> {
    try {
      const records = await this.mediatorRepository.findByQuery({ connectionId })
      return records[0]
    } catch (error) {
      return null
    }
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
      const records = (await this.mediatorRepository.getAll()) ?? []
      for (const record of records) {
        if (record.default) {
          this.setDefaultMediator(record)
          return this.defaultMediator
        }
      }
    }
    return this.defaultMediator
  }

  public async discoverMediation(mediatorId: string | undefined) {
    let mediationRecord: MediationRecord | null = null
    const defaultMediator = await this.getDefaultMediator()
    if (mediatorId) {
      mediationRecord = await this.findById(mediatorId)
    } else if (defaultMediator) {
      mediationRecord = defaultMediator
      if (mediationRecord.state !== MediationState.Granted) {
        throw new Error(`Mediation State for ${mediationRecord.id} is not granted!`)
      }
      return mediationRecord
    }
  }

  public async setDefaultMediator(mediator: MediationRecord) {
    // Get list of all mediator records. For each record, update default all others to false.
    const fetchedRecords = (await this.getMediators()) ?? []

    for (const record of fetchedRecords) {
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
    for (const record of fetchedRecords) {
      record.default = false
      await this.mediatorRepository.update(record)
    }
    delete this.defaultMediator
  }
}
