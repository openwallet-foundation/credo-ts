import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import { EventEmitter, injectable } from '@credo-ts/core'
import type { DidCommInboundMessageContext } from '../../../models'
import { DidCommConnectionRecord } from '../../connections'
import type { DidCommBasicMessageStateChangedEvent } from '../DidCommBasicMessageEvents'
import { DidCommBasicMessageEventTypes } from '../DidCommBasicMessageEvents'
import { DidCommBasicMessageRole } from '../DidCommBasicMessageRole'
import { DidCommBasicMessage } from '../messages'
import { DidCommBasicMessageRecord, DidCommBasicMessageRepository } from '../repository'

@injectable()
export class DidCommBasicMessageService {
  private basicMessageRepository: DidCommBasicMessageRepository
  private eventEmitter: EventEmitter

  public constructor(basicMessageRepository: DidCommBasicMessageRepository, eventEmitter: EventEmitter) {
    this.basicMessageRepository = basicMessageRepository
    this.eventEmitter = eventEmitter
  }

  public async createMessage(
    agentContext: AgentContext,
    message: string,
    connectionRecord: DidCommConnectionRecord,
    parentThreadId?: string
  ) {
    const basicMessage = new DidCommBasicMessage({ content: message })

    // If no parentThreadid is defined, there is no need to explicitly send a thread decorator
    if (parentThreadId) {
      basicMessage.setThread({ parentThreadId })
    }

    const basicMessageRecord = new DidCommBasicMessageRecord({
      sentTime: basicMessage.sentTime.toISOString(),
      content: basicMessage.content,
      connectionId: connectionRecord.id,
      role: DidCommBasicMessageRole.Sender,
      threadId: basicMessage.threadId,
      parentThreadId,
    })

    await this.basicMessageRepository.save(agentContext, basicMessageRecord)
    this.emitStateChangedEvent(agentContext, basicMessageRecord, basicMessage)

    return { message: basicMessage, record: basicMessageRecord }
  }

  /**
   * @todo use connection from message context
   */
  public async save(
    { message, agentContext }: DidCommInboundMessageContext<DidCommBasicMessage>,
    connection: DidCommConnectionRecord
  ) {
    const basicMessageRecord = new DidCommBasicMessageRecord({
      sentTime: message.sentTime.toISOString(),
      content: message.content,
      connectionId: connection.id,
      role: DidCommBasicMessageRole.Receiver,
      threadId: message.threadId,
      parentThreadId: message.thread?.parentThreadId,
    })

    await this.basicMessageRepository.save(agentContext, basicMessageRecord)
    this.emitStateChangedEvent(agentContext, basicMessageRecord, message)
  }

  private emitStateChangedEvent(
    agentContext: AgentContext,
    basicMessageRecord: DidCommBasicMessageRecord,
    basicMessage: DidCommBasicMessage
  ) {
    this.eventEmitter.emit<DidCommBasicMessageStateChangedEvent>(agentContext, {
      type: DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
      payload: { message: basicMessage, basicMessageRecord: basicMessageRecord.clone() },
    })
  }

  public async findAllByQuery(
    agentContext: AgentContext,
    query: Query<DidCommBasicMessageRecord>,
    queryOptions?: QueryOptions
  ) {
    return this.basicMessageRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async getById(agentContext: AgentContext, basicMessageRecordId: string) {
    return this.basicMessageRepository.getById(agentContext, basicMessageRecordId)
  }

  public async getByThreadId(agentContext: AgentContext, threadId: string) {
    return this.basicMessageRepository.getSingleByQuery(agentContext, { threadId })
  }

  public async findAllByParentThreadId(agentContext: AgentContext, parentThreadId: string) {
    return this.basicMessageRepository.findByQuery(agentContext, { parentThreadId })
  }

  public async deleteById(agentContext: AgentContext, basicMessageRecordId: string) {
    const basicMessageRecord = await this.getById(agentContext, basicMessageRecordId)
    return this.basicMessageRepository.delete(agentContext, basicMessageRecord)
  }
}
