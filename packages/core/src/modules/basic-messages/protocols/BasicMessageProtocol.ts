import type { BasicMessageProtocolMsgReturnType, CreateMessageOptions } from './BasicMessageProtocolOptions'
import type { AgentContext } from '../../../agent'
import type { AgentBaseMessage } from '../../../agent/AgentBaseMessage'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../plugins'
import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'

export interface BasicMessageProtocol {
  readonly version: string

  createMessage(
    agentContext: AgentContext,
    options: CreateMessageOptions
  ): Promise<BasicMessageProtocolMsgReturnType<AgentBaseMessage>>

  save({ message, agentContext }: InboundMessageContext<AgentBaseMessage>, connection: ConnectionRecord): Promise<void>

  register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}
