import type { Query, QueryOptions } from '@credo-ts/core'
import { AgentContext, injectable } from '@credo-ts/core'
import { DidCommMessageSender } from '../../DidCommMessageSender'
import { DidCommOutboundMessageContext } from '../../models'
import { DidCommConnectionService } from '../connections/services'
import type { DidCommBasicMessageRecord } from './repository/DidCommBasicMessageRecord'
import { DidCommBasicMessageService } from './services'
import { DidCommBasicMessagesModuleConfig } from './DidCommBasicMessagesModuleConfig'

@injectable()
export class DidCommBasicMessagesApi {
  private basicMessageService: DidCommBasicMessageService
  private messageSender: DidCommMessageSender
  private connectionService: DidCommConnectionService
  private agentContext: AgentContext
  private config: DidCommBasicMessagesModuleConfig

  public constructor(
    basicMessageService: DidCommBasicMessageService,
    messageSender: DidCommMessageSender,
    connectionService: DidCommConnectionService,
    agentContext: AgentContext,
    config: DidCommBasicMessagesModuleConfig
  ) {
    this.basicMessageService = basicMessageService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.config = config
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
  public async sendMessage(connectionId: string, message: string, parentThreadId?: string) {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)

    // Select BM protocol version based on the connection's DIDComm envelope version:
    //   - v2 connection => BM 2.0 (only if config supports it)
    //   - v1 connection => BM 1.0 (legacy interop, even if config includes v2)
    // This ensures we don't send BM 2.0 to a peer that only speaks v1.
    const useBmV2 = this.config.supportsV2 && connection.didcommVersion === 'v2'

    const { message: basicMessage, record: basicMessageRecord } = useBmV2
      ? await this.basicMessageService.createMessageV2(this.agentContext, message, connection, parentThreadId)
      : await this.basicMessageService.createMessage(this.agentContext, message, connection, parentThreadId)

    const outboundMessageContext = new DidCommOutboundMessageContext(basicMessage, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: basicMessageRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)
    return basicMessageRecord
  }

  /**
   * Retrieve all basic messages matching a given query
   *
   * @param query The query
   * @param queryOptions The query options
   * @returns array containing all matching records
   */
  public async findAllByQuery(query: Query<DidCommBasicMessageRecord>, queryOptions?: QueryOptions) {
    return this.basicMessageService.findAllByQuery(this.agentContext, query, queryOptions)
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
   * Retrieve a basic message record by thread id
   *
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The connection record
   */
  public async getByThreadId(basicMessageRecordId: string) {
    return this.basicMessageService.getByThreadId(this.agentContext, basicMessageRecordId)
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
}
