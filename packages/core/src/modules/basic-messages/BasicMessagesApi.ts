import type { BasicMessageProtocol, V2BasicMessage } from './protocols'
import type { BasicMessageRecord } from './repository/BasicMessageRecord'
import type { Query } from '../../storage/StorageService'

import { AgentContext } from '../../agent'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
import { AriesFrameworkError } from '../../error'
import { injectable } from '../../plugins'
import { ConnectionService } from '../connections'

import { BasicMessagesModuleConfig } from './BasicMessagesModuleConfig'
import { BasicMessageRepository } from './repository'

export interface BasicMessagesApi<BMPs extends BasicMessageProtocol[]> {
  sendMessage(connectionId: string, message: string, parentThreadId?: string): Promise<BasicMessageRecord>

  findAllByQuery(query: Query<BasicMessageRecord>): Promise<BasicMessageRecord[]>
  getById(basicMessageRecordId: string): Promise<BasicMessageRecord>
  getByThreadId(threadId: string): Promise<BasicMessageRecord>
  deleteById(basicMessageRecordId: string): Promise<void>
}

@injectable()
export class BasicMessagesApi<BMPs extends BasicMessageProtocol[]> implements BasicMessagesApi<BMPs> {
  public readonly config: BasicMessagesModuleConfig<BMPs>

  private basicMessageRepository: BasicMessageRepository
  private messageSender: MessageSender
  private connectionService: ConnectionService
  private agentContext: AgentContext

  public constructor(
    basicMessageRepository: BasicMessageRepository,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentContext: AgentContext,
    config: BasicMessagesModuleConfig<BMPs>
  ) {
    this.basicMessageRepository = basicMessageRepository
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.config = config
  }

  private getProtocol<PVT extends BMPs[number]['version']>(protocolVersion: PVT): BasicMessageProtocol {
    const basicMessageProtocol = this.config.basicMessageProtocols.find(
      (protocol) => protocol.version === protocolVersion
    )

    if (!basicMessageProtocol) {
      throw new AriesFrameworkError(`No basic message protocol registered for protocol version ${protocolVersion}`)
    }

    return basicMessageProtocol
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

    // TODO: Parameterize in API
    const basicMessageProtocol = this.getProtocol(connection.isDidCommV1Connection ? 'v1' : 'v2')

    const { message: basicMessage, record: basicMessageRecord } = await basicMessageProtocol.createMessage(
      this.agentContext,
      {
        content: message,
        connectionRecord: connection,
        parentThreadId,
      }
    )
    const outboundMessageContext = new OutboundMessageContext(basicMessage as V2BasicMessage, {
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
   * @returns array containing all matching records
   */
  public async findAllByQuery(query: Query<BasicMessageRecord>) {
    return this.basicMessageRepository.findByQuery(this.agentContext, query)
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
    return this.basicMessageRepository.getById(this.agentContext, basicMessageRecordId)
  }

  /**
   * Retrieve a basic message record by thread id
   *
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The connection record
   */
  public async getByThreadId(threadId: string) {
    return this.basicMessageRepository.getSingleByQuery(this.agentContext, { threadId })
  }

  /**
   * Delete a basic message record by id
   *
   * @param connectionId the basic message record id
   * @throws {RecordNotFoundError} If no record is found
   */
  public async deleteById(basicMessageRecordId: string) {
    await this.basicMessageRepository.deleteById(this.agentContext, basicMessageRecordId)
  }
}
