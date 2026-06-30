import type { AgentContext, EventEmitter, Query, QueryOptions } from '@credo-ts/core'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import type { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import type { DidCommBasicMessageRecord, DidCommBasicMessageRepository } from '../repository'

export abstract class DidCommBaseBasicMessageService {
  protected basicMessageRepository: DidCommBasicMessageRepository
  protected eventEmitter: EventEmitter

  public constructor(basicMessageRepository: DidCommBasicMessageRepository, eventEmitter: EventEmitter) {
    this.basicMessageRepository = basicMessageRepository
    this.eventEmitter = eventEmitter
  }

  public abstract readonly version: string

  public abstract register(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    featureRegistry: DidCommFeatureRegistry
  ): void

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
