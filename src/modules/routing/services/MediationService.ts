import { Lifecycle, scoped } from 'tsyringe'
import { Verkey } from 'indy-sdk'

import { AgentConfig } from '../../../agent/AgentConfig'
import { createOutboundMessage } from '../../../agent/helpers'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { MediationRepository } from '../repository/MediationRepository'
import { ConnectionRecord } from '../../connections'
import { MediationDenyMessage, MediationGrantMessage } from '../messages'
import { MediationRequestMessage } from '../messages/MediationRequestMessage'
import { MediationRole } from '../models/MediationRole'
import { MediationState } from '../models/MediationState'
import { MediationRecord, MediationRecordProps } from '../repository/MediationRecord'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MediationStateChangedEvent, RoutingEventTypes } from '../RoutingEvents'

@scoped(Lifecycle.ContainerScoped)
export class MediationService {
  private eventEmitter: EventEmitter
  private mediationRepository: MediationRepository
  private agentConfig: AgentConfig
  private routingKey?: Verkey

  public constructor(eventEmitter: EventEmitter, mediationRepository: MediationRepository, agentConfig: AgentConfig) {
    this.eventEmitter = eventEmitter
    this.mediationRepository = mediationRepository
    this.agentConfig = agentConfig
  }

  public setRoutingKey(verkey: Verkey) {
    this.routingKey = verkey
  }

  public async requestMediation(connection: ConnectionRecord) {
    await this.create({
      connectionId: connection.id,
      role: MediationRole.Recipient,
      state: MediationState.Requested,
    })

    const mediationRequestMessage = new MediationRequestMessage({})

    return createOutboundMessage(connection, mediationRequestMessage)
  }

  public async grantMediation(connection: ConnectionRecord, mediation: MediationRecord) {
    mediation.routingKeys = this.routingKey ? [this.routingKey] : []

    const grantMediationMessage = new MediationGrantMessage({
      endpoint: this.agentConfig.getEndpoint(),
      routing_keys: mediation.routingKeys,
    })

    return createOutboundMessage(connection, grantMediationMessage)
  }

  public async processMediationRequest(messageContext: InboundMessageContext<MediationRequestMessage>) {
    const connection = messageContext.connection

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error('No connection associated with incoming mediation grant message')
    }

    const mediationRecord = await this.create({
      connectionId: connection.id,
      role: MediationRole.Mediator,
      state: MediationState.Init,
    })

    // Mediation can be either granted or denied. Let business logic decide that
    await this.updateState(mediationRecord, MediationState.Requested)
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    const connection = messageContext.connection

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error('No connection associated with incoming mediation grant message')
    }

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(messageContext.connection?.id || '')

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertConnection(connection.id)

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint
    mediationRecord.routingKeys = messageContext.message.routing_keys
    await this.updateState(mediationRecord, MediationState.Granted)

    return mediationRecord
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const connection = messageContext.connection

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error('No connection associated with incoming mediation deny message')
    }

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(messageContext.connection?.id || '')

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

  public async create(options: MediationRecordProps): Promise<MediationRecord> {
    const mediationRecord = new MediationRecord(options)
    await this.mediationRepository.save(mediationRecord)
    return mediationRecord
  }

  public async findById(id: string): Promise<MediationRecord | null> {
    return await this.mediationRepository.findById(id)
  }

  public async findByConnectionId(id: string): Promise<MediationRecord | null> {
    // TODO: Use findByQuery (connectionId as tag)
    const mediationRecords = await this.mediationRepository.getAll()

    for (const record of mediationRecords) {
      if (record.connectionId == id) {
        return record
      }
    }
    return null
  }

  public async getAll(): Promise<MediationRecord[] | null> {
    return await this.mediationRepository.getAll()
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param proofRecord The proof record to update the state for
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
  }
}
