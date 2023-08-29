import type { BasicMessageProtocol } from './BasicMessageProtocol'
import type { BasicMessageProtocolMsgReturnType, CreateMessageOptions } from './BasicMessageProtocolOptions'
import type { AgentContext } from '../../../agent'
import type { AgentBaseMessage } from '../../../agent/AgentBaseMessage'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../plugins'
import type { Query } from '../../../storage/StorageService'
import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'
import type { BasicMessageRecord } from '../repository'

import { BasicMessageRepository } from '../repository'

export abstract class BaseBasicMessageProtocol implements BasicMessageProtocol {
  public abstract readonly version: string

  public abstract createMessage(
    agentContext: AgentContext,
    options: CreateMessageOptions
  ): Promise<BasicMessageProtocolMsgReturnType<AgentBaseMessage>>

  /**
   * @todo use connection from message context
   */
  public abstract save(
    { message, agentContext }: InboundMessageContext<AgentBaseMessage>,
    connection: ConnectionRecord
  ): Promise<void>

  public async findAllByQuery(agentContext: AgentContext, query: Query<BasicMessageRecord>) {
    const basicMessageRepository = agentContext.dependencyManager.resolve(BasicMessageRepository)
    return basicMessageRepository.findByQuery(agentContext, query)
  }

  public async getById(agentContext: AgentContext, basicMessageRecordId: string) {
    const basicMessageRepository = agentContext.dependencyManager.resolve(BasicMessageRepository)
    return basicMessageRepository.getById(agentContext, basicMessageRecordId)
  }

  public async getByThreadId(agentContext: AgentContext, threadId: string) {
    const basicMessageRepository = agentContext.dependencyManager.resolve(BasicMessageRepository)
    return basicMessageRepository.getSingleByQuery(agentContext, { threadId })
  }

  public async findAllByParentThreadId(agentContext: AgentContext, parentThreadId: string) {
    const basicMessageRepository = agentContext.dependencyManager.resolve(BasicMessageRepository)
    return basicMessageRepository.findByQuery(agentContext, { parentThreadId })
  }

  public async deleteById(agentContext: AgentContext, basicMessageRecordId: string) {
    const basicMessageRepository = agentContext.dependencyManager.resolve(BasicMessageRepository)
    return basicMessageRepository.deleteById(agentContext, basicMessageRecordId)
  }

  public abstract register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}
