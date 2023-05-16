import type { MessagePickupProtocol } from './MessagePickupProtocol'
import type { PickupMessagesProtocolOptions, PickupMessagesProtocolReturnType } from './MessagePickupProtocolOptions'
import type { AgentContext } from '../../../agent'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { DidCommV1Message } from '../../../didcomm'
import type { DependencyManager } from '../../../plugins'

/**
 * Base implementation of the MessagePickupProtocol that can be used as a foundation for implementing
 * the MessagePickupProtocol interface.
 */
export abstract class BaseMessagePickupProtocol implements MessagePickupProtocol {
  public abstract readonly version: string

  public abstract pickupMessages(
    agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<DidCommV1Message>>

  public abstract register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}
