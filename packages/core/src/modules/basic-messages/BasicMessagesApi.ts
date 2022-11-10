import type { Query } from '../../storage/StorageService'
import type { BasicMessageRecord } from './repository/BasicMessageRecord'

import { AgentContext } from '../../agent'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundDIDCommV1Message } from '../../agent/helpers'
import { injectable } from '../../plugins'
import { ConnectionService } from '../connections'

import { BasicMessageHandler } from './handlers'
import { BasicMessageService } from './services'

@injectable()
export class BasicMessagesApi {
  private basicMessageService: BasicMessageService
  private messageSender: MessageSender
  private connectionService: ConnectionService
  private agentContext: AgentContext

  public constructor(
    dispatcher: Dispatcher,
    basicMessageService: BasicMessageService,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentContext: AgentContext
  ) {
    this.basicMessageService = basicMessageService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.registerHandlers(dispatcher)
  }

  /**
   * Send a message to an active connection
   *
   * @param connectionId Connection Id
   * @param message Message contents
   * @throws {RecordNotFoundError} If connection is not found
   * @throws {MessageSendingError} If message is undeliverable
   * @returns the created record
   */
  public async sendMessage(connectionId: string, message: string) {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)

    const { message: basicMessage, record: basicMessageRecord } = await this.basicMessageService.createMessage(
      this.agentContext,
      message,
      connection
    )
    const outboundMessage = createOutboundDIDCommV1Message(connection, basicMessage)
    outboundMessage.associatedRecord = basicMessageRecord

    await this.messageSender.sendMessage(this.agentContext, outboundMessage)
    return basicMessageRecord
  }

  /**
   * Retrieve all basic messages matching a given query
   *
   * @param query The query
   * @returns array containing all matching records
   */
  public async findAllByQuery(query: Query<BasicMessageRecord>) {
    return this.basicMessageService.findAllByQuery(this.agentContext, query)
  }

  /**
   * Retrieve a basic message record by id
   *
   * @param basicMessageRecordId The basic message record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The basic message record
   *
   */
  public async getById(basicMessageRecordId: string) {
    return this.basicMessageService.getById(this.agentContext, basicMessageRecordId)
  }

  /**
   * Delete a basic message record by id
   *
   * @param connectionId the basic message record id
   * @throws {RecordNotFoundError} If no record is found
   */
  public async deleteById(basicMessageRecordId: string) {
    await this.basicMessageService.deleteById(this.agentContext, basicMessageRecordId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new BasicMessageHandler(this.basicMessageService))
  }
}
