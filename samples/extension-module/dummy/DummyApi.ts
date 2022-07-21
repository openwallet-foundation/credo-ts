import type { DummyRecord } from './repository/DummyRecord'

import { AgentContext, ConnectionService, Dispatcher, injectable, MessageSender } from '@aries-framework/core'

import { DummyRequestHandler, DummyResponseHandler } from './handlers'
import { DummyState } from './repository'
import { DummyService } from './services'

@injectable()
export class DummyApi {
  private messageSender: MessageSender
  private dummyService: DummyService
  private connectionService: ConnectionService
  private agentContext: AgentContext

  public constructor(
    dispatcher: Dispatcher,
    messageSender: MessageSender,
    dummyService: DummyService,
    connectionService: ConnectionService,
    agentContext: AgentContext
  ) {
    this.messageSender = messageSender
    this.dummyService = dummyService
    this.connectionService = connectionService
    this.agentContext = agentContext

    this.registerHandlers(dispatcher)
  }

  /**
   * Send a Dummy Request
   *
   * @param connection record of the target responder (must be active)
   * @returns created Dummy Record
   */
  public async request(connectionId: string) {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    const { record, message: payload } = await this.dummyService.createRequest(this.agentContext, connection)

    await this.messageSender.sendMessage(this.agentContext, { connection, payload })

    await this.dummyService.updateState(this.agentContext, record, DummyState.RequestSent)

    return record
  }

  /**
   * Respond a Dummy Request
   *
   * @param record Dummy record
   * @returns Updated dummy record
   */
  public async respond(dummyId: string) {
    const record = await this.dummyService.getById(this.agentContext, dummyId)
    const connection = await this.connectionService.getById(this.agentContext, record.connectionId)

    const payload = await this.dummyService.createResponse(this.agentContext, record)

    await this.messageSender.sendMessage(this.agentContext, { connection, payload })

    await this.dummyService.updateState(this.agentContext, record, DummyState.ResponseSent)

    return record
  }

  /**
   * Retrieve all dummy records
   *
   * @returns List containing all records
   */
  public getAll(): Promise<DummyRecord[]> {
    return this.dummyService.getAll(this.agentContext)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new DummyRequestHandler(this.dummyService))
    dispatcher.registerHandler(new DummyResponseHandler(this.dummyService))
  }
}
