import type { PickupMessagesProtocolOptions, PickupMessagesProtocolReturnType } from './MessagePickupProtocolOptions'
import type { AgentContext } from '../../../agent'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { DependencyManager } from '../../../plugins'

export interface MessagePickupProtocol {
  readonly version: string

  pickupMessages(
    agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<AgentMessage>>

  register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}
