import type { PickupMessagesProtocolOptions, PickupMessagesProtocolReturnType } from './MessagePickupProtocolOptions'
import type { AgentContext } from '../../../agent'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { DidCommV1Message } from '../../../didcomm'
import type { DependencyManager } from '../../../plugins'

export interface MessagePickupProtocol {
  readonly version: string

  pickupMessages(
    agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<DidCommV1Message>>

  register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}
