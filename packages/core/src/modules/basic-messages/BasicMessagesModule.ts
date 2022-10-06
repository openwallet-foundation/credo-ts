import type { DependencyManager } from '../../plugins'
import type { BasicMessageTags } from './repository/BasicMessageRecord'

import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { MessageSendingError } from '../../error/MessageSendingError'
import { injectable, module } from '../../plugins'
import { ConnectionService } from '../connections'

import { BasicMessageHandler } from './handlers'
import { BasicMessageRepository } from './repository'
import { BasicMessageService } from './services'

@module()
@injectable()
export class BasicMessagesModule {
  private basicMessageService: BasicMessageService
  private messageSender: MessageSender
  private connectionService: ConnectionService

  public constructor(
    dispatcher: Dispatcher,
    basicMessageService: BasicMessageService,
    messageSender: MessageSender,
    connectionService: ConnectionService
  ) {
    this.basicMessageService = basicMessageService
    this.messageSender = messageSender
    this.connectionService = connectionService
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
    const connection = await this.connectionService.getById(connectionId)

    const { message: basicMessage, record: basicMessageRecord } = await this.basicMessageService.createMessage(
      message,
      connection
    )
    const outboundMessage = createOutboundMessage(connection, basicMessage)
    try {
      await this.messageSender.sendMessage(outboundMessage)
    } catch (error) {
      throw new MessageSendingError(`Error sending basic message: ${error.message}`, {
        agentMessage: basicMessage,
        associatedRecord: basicMessageRecord,
        cause: error,
      })
    }
    return basicMessageRecord
  }

  /**
   * Retrieve all basic messages matching a given query
   *
   * @param query The query
   * @returns array containing all matching records
   */
  public async findAllByQuery(query: Partial<BasicMessageTags>) {
    return this.basicMessageService.findAllByQuery(query)
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
    return this.basicMessageService.getById(basicMessageRecordId)
  }

  /**
   * Delete a basic message record by id
   *
   * @param connectionId the basic message record id
   * @throws {RecordNotFoundError} If no record is found
   */
  public async deleteById(basicMessageRecordId: string) {
    await this.basicMessageService.deleteById(basicMessageRecordId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new BasicMessageHandler(this.basicMessageService))
  }

  /**
   * Registers the dependencies of the basic message module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(BasicMessagesModule)

    // Services
    dependencyManager.registerSingleton(BasicMessageService)

    // Repositories
    dependencyManager.registerSingleton(BasicMessageRepository)
  }
}
