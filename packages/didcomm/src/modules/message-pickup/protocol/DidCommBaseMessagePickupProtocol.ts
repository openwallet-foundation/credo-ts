import type { AgentContext } from '@credo-ts/core'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import type { DidCommMessagePickupProtocol } from './DidCommMessagePickupProtocol'
import type {
  DeliverMessagesProtocolOptions,
  DeliverMessagesProtocolReturnType,
  PickupMessagesProtocolOptions,
  PickupMessagesProtocolReturnType,
  SetLiveDeliveryModeProtocolOptions,
  SetLiveDeliveryModeProtocolReturnType,
} from './DidCommMessagePickupProtocolOptions'

/**
 * Base implementation of the MessagePickupProtocol that can be used as a foundation for implementing
 * the MessagePickupProtocol interface.
 */
export abstract class DidCommBaseMessagePickupProtocol implements DidCommMessagePickupProtocol {
  public abstract readonly version: string

  public abstract createPickupMessage(
    agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<DidCommMessage>>

  public abstract createDeliveryMessage(
    agentContext: AgentContext,
    options: DeliverMessagesProtocolOptions
  ): Promise<DeliverMessagesProtocolReturnType<DidCommMessage> | undefined>

  public abstract setLiveDeliveryMode(
    agentContext: AgentContext,
    options: SetLiveDeliveryModeProtocolOptions
  ): Promise<SetLiveDeliveryModeProtocolReturnType<DidCommMessage>>

  public abstract register(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    featureRegistry: DidCommFeatureRegistry
  ): void
}
