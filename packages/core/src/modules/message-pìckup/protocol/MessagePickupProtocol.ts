import type {
  PickupMessagesOptions,
  PickupMessagesReturnType,
  QueueMessageOptions,
  QueueMessageReturnType,
} from './MessagePickupProtocolOptions'
import type { AgentContext } from '../../../agent'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { DependencyManager } from '../../../plugins'

export interface MessagePickupProtocol {
  readonly version: string

  queueMessage(agentContext: AgentContext, options: QueueMessageOptions): Promise<QueueMessageReturnType>
  pickupMessages(
    agentContext: AgentContext,
    options: PickupMessagesOptions
  ): Promise<PickupMessagesReturnType<AgentMessage>>

  register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}
