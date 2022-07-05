import type { DummyRecord } from './repository/DummyRecord'

import { injectable, ConnectionService, Dispatcher, MessageSender } from '@aries-framework/core'

import { DummyRequestHandler, DummyResponseHandler } from './handlers'
import { DummyState } from './repository'
import { DummyService } from './services'

@injectable()
export class DummyApi {
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
  public async request(connectionId: string) {
    const connection = await this.connectionService.getById(connectionId)
    const { record, message: payload } = await this.dummyService.createRequest(connection)

    await this.messageSender.sendMessage({ connection, payload })

    await this.dummyService.updateState(record, DummyState.RequestSent)

    return record
  }

  /**
   * Respond a Dummy Request
   *
   * @param record Dummy record
   * @returns Updated dummy record
   */
  public async respond(dummyId: string) {
    const record = await this.dummyService.getById(dummyId)
    const connection = await this.connectionService.getById(record.connectionId)

    const payload = await this.dummyService.createResponse(record)

    await this.messageSender.sendMessage({ connection, payload })

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
    dispatcher.registerHandler(new DummyRequestHandler(this.dummyService))
    dispatcher.registerHandler(new DummyResponseHandler(this.dummyService))
  }
}
