import type { DummyRecord } from './repository/DummyRecord'
import type { ConnectionRecord } from '@aries-framework/core'

import { ConnectionService, Dispatcher, MessageSender } from '@aries-framework/core'
import { Lifecycle, scoped } from 'tsyringe'

import { DummyRequestHandler, DummyResponseHandler } from './handlers'
import { DummyState } from './repository'
import { DummyService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class DummyModule {
  private messageSender: MessageSender
  private dummyService: DummyService
  private connectionService: ConnectionService

  public constructor(
    dispatcher: Dispatcher,
    messageSender: MessageSender,
    dummyService: DummyService,
    connectionService: ConnectionService
  ) {
    this.messageSender = messageSender
    this.dummyService = dummyService
    this.connectionService = connectionService
    this.registerHandlers(dispatcher)
  }

  /**
   * Send a Dummy Request
   *
   * @param connection record of the target responder (must be active)
   * @returns created Dummy Record
   */
  public async request(connection: ConnectionRecord) {
    const { record, message: payload } = await this.dummyService.createRequest(connection)

    await this.messageSender.sendDIDCommV1Message({ connection, payload })

    await this.dummyService.updateState(record, DummyState.RequestSent)

    return record
  }

  /**
   * Respond a Dummy Request
   *
   * @param record Dummy record
   * @returns Updated dummy record
   */
  public async respond(record: DummyRecord) {
    if (!record.connectionId) {
      throw new Error('Connection not found!')
    }

    const connection = await this.connectionService.getById(record.connectionId)

    const payload = await this.dummyService.createResponse(record)

    await this.messageSender.sendDIDCommV1Message({ connection, payload })

    await this.dummyService.updateState(record, DummyState.ResponseSent)

    return record
  }

  /**
   * Retrieve all dummy records
   *
   * @returns List containing all records
   */
  public getAll(): Promise<DummyRecord[]> {
    return this.dummyService.getAll()
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerDIDCommV1Handler(new DummyRequestHandler(this.dummyService))
    dispatcher.registerDIDCommV1Handler(new DummyResponseHandler(this.dummyService))
  }
}
