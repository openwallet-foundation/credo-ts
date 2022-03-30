import type { DummyStateChangedEvent } from './DummyEvents'
import type { ConnectionRecord, InboundMessageContext } from '@aries-framework/core'

import { EventEmitter } from '@aries-framework/core'
import { Lifecycle, scoped } from 'tsyringe'

import { DummyRequestMessage, DummyResponseMessage } from '../messages'
import { DummyRecord } from '../repository/DummyRecord'
import { DummyRepository } from '../repository/DummyRepository'
import { DummyState } from '../repository/DummyState'

import { DummyEventTypes } from './DummyEvents'

@scoped(Lifecycle.ContainerScoped)
export class DummyService {
  private dummyRepository: DummyRepository
  private eventEmitter: EventEmitter

  public constructor(dummyRepository: DummyRepository, eventEmitter: EventEmitter) {
    this.dummyRepository = dummyRepository
    this.eventEmitter = eventEmitter
  }

  public async createRequest(connectionRecord: ConnectionRecord) {
    // Create message
    const message = new DummyRequestMessage({})

    // Create record
    const record = new DummyRecord({
      connectionId: connectionRecord.id,
      threadId: message.id,
      state: DummyState.Init,
    })

    await this.dummyRepository.save(record)

    this.eventEmitter.emit<DummyStateChangedEvent>({
      type: DummyEventTypes.StateChanged,
      payload: {
        dummyRecord: record,
        previousState: null,
      },
    })

    return { record, message }
  }

  public async createResponse(record: DummyRecord) {
    const responseMessage = new DummyResponseMessage({
      threadId: record.threadId,
    })

    return responseMessage
  }

  public async processRequest(messageContext: InboundMessageContext<DummyRequestMessage>) {
    const connectionRecord = messageContext.connection

    // Create record
    const record = new DummyRecord({
      connectionId: connectionRecord?.id,
      threadId: messageContext.message.id,
      state: DummyState.RequestReceived,
    })

    await this.dummyRepository.save(record)

    this.eventEmitter.emit<DummyStateChangedEvent>({
      type: DummyEventTypes.StateChanged,
      payload: {
        dummyRecord: record,
        previousState: null,
      },
    })

    return record
  }

  public async processResponse(messageContext: InboundMessageContext<DummyResponseMessage>) {
    const { connection, message } = messageContext

    // Identity Verification record already exists
    const record = await this.findByThreadAndConnectionId(message.threadId, connection?.id)

    if (record) {
      // Check current state
      record.assertState(DummyState.RequestSent)

      await this.updateState(record, DummyState.ResponseReceived)
    } else {
      throw new Error(`Dummy record Verification not found with threadId ${message.threadId}`)
    }

    return record
  }

  /**
   * Retrieve all dummy records
   *
   * @returns List containing all dummy records
   */
  public getAll(): Promise<DummyRecord[]> {
    return this.dummyRepository.getAll()
  }

  /**
   * Retrieve a dummy record by id
   *
   * @param identityVerificationRecordId The credential record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The credential record
   *
   */
  public getById(dummyRecordId: string): Promise<DummyRecord> {
    return this.dummyRepository.getById(dummyRecordId)
  }

  /**
   * Retrieve a dummy record by connection id and thread id
   *
   * @param connectionId The connection id
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The dummy record
   */
  public async findByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<DummyRecord | null> {
    return this.dummyRepository.findSingleByQuery({ threadId, connectionId })
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param dummyRecord The record to update the state for
   * @param newState The state to update to
   *
   */
  public async updateState(dummyRecord: DummyRecord, newState: DummyState) {
    const previousState = dummyRecord.state
    dummyRecord.state = newState
    await this.dummyRepository.update(dummyRecord)

    this.eventEmitter.emit<DummyStateChangedEvent>({
      type: DummyEventTypes.StateChanged,
      payload: { dummyRecord, previousState: previousState },
    })
  }
}
