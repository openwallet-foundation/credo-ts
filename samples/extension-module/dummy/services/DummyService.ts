import type { DummyStateChangedEvent } from './DummyEvents'
import type { ConnectionRecord, InboundMessageContext } from '@aries-framework/core'

import { injectable, JsonTransformer, EventEmitter } from '@aries-framework/core'

import { DummyRequestMessage, DummyResponseMessage } from '../messages'
import { DummyRecord } from '../repository/DummyRecord'
import { DummyRepository } from '../repository/DummyRepository'
import { DummyState } from '../repository/DummyState'

import { DummyEventTypes } from './DummyEvents'

@injectable()
export class DummyService {
  private dummyRepository: DummyRepository
  private eventEmitter: EventEmitter

  public constructor(dummyRepository: DummyRepository, eventEmitter: EventEmitter) {
    this.dummyRepository = dummyRepository
    this.eventEmitter = eventEmitter
  }

  /**
   * Create a {@link DummyRequestMessage}.
   *
   * @param connectionRecord The connection for which to create the dummy request
   * @returns Object containing dummy request message and associated dummy record
   *
   */
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

    this.emitStateChangedEvent(record, null)

    return { record, message }
  }

  /**
   * Create a dummy response message for the specified dummy record.
   *
   * @param record the dummy record for which to create a dummy response
   * @returns outbound message containing dummy response
   */
  public async createResponse(record: DummyRecord) {
    const responseMessage = new DummyResponseMessage({
      threadId: record.threadId,
    })

    return responseMessage
  }

  /**
   * Process a received {@link DummyRequestMessage}.
   *
   * @param messageContext The message context containing a dummy request message
   * @returns dummy record associated with the dummy request message
   *
   */
  public async processRequest(messageContext: InboundMessageContext<DummyRequestMessage>) {
    const connectionRecord = messageContext.assertReadyConnection()

    // Create record
    const record = new DummyRecord({
      connectionId: connectionRecord.id,
      threadId: messageContext.message.id,
      state: DummyState.RequestReceived,
    })

    await this.dummyRepository.save(record)

    this.emitStateChangedEvent(record, null)

    return record
  }

  /**
   * Process a received {@link DummyResponseMessage}.
   *
   * @param messageContext The message context containing a dummy response message
   * @returns dummy record associated with the dummy response message
   *
   */
  public async processResponse(messageContext: InboundMessageContext<DummyResponseMessage>) {
    const { message } = messageContext

    const connection = messageContext.assertReadyConnection()

    // Dummy record already exists
    const record = await this.findByThreadAndConnectionId(message.threadId, connection.id)

    if (record) {
      // Check current state
      record.assertState(DummyState.RequestSent)

      await this.updateState(record, DummyState.ResponseReceived)
    } else {
      throw new Error(`Dummy record not found with threadId ${message.threadId}`)
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
   * @param dummyRecordId The dummy record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The dummy record
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

    this.emitStateChangedEvent(dummyRecord, previousState)
  }

  private emitStateChangedEvent(dummyRecord: DummyRecord, previousState: DummyState | null) {
    // we need to clone the dummy record to avoid mutating records after they're emitted in an event
    const clonedDummyRecord = JsonTransformer.clone(dummyRecord)

    this.eventEmitter.emit<DummyStateChangedEvent>({
      type: DummyEventTypes.StateChanged,
      payload: { dummyRecord: clonedDummyRecord, previousState: previousState },
    })
  }
}
