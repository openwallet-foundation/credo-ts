import type { AgentContext } from '@credo-ts/core'
import type { AgentMessage } from '../../../AgentMessage'
import type { FeatureRegistry } from '../../../FeatureRegistry'
import type { MessageHandlerRegistry } from '../../../MessageHandlerRegistry'
import type {
  DeliverMessagesProtocolOptions,
  DeliverMessagesProtocolReturnType,
  PickupMessagesProtocolOptions,
  PickupMessagesProtocolReturnType,
  SetLiveDeliveryModeProtocolOptions,
  SetLiveDeliveryModeProtocolReturnType,
} from './MessagePickupProtocolOptions'

export interface MessagePickupProtocol {
  readonly version: string

  createPickupMessage(
    agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<AgentMessage>>

  createDeliveryMessage(
    agentContext: AgentContext,
    options: DeliverMessagesProtocolOptions
  ): Promise<DeliverMessagesProtocolReturnType<AgentMessage> | undefined>

  setLiveDeliveryMode(
    agentContext: AgentContext,
    options: SetLiveDeliveryModeProtocolOptions
  ): Promise<SetLiveDeliveryModeProtocolReturnType<AgentMessage>>

  register(messageHandlerRegistry: MessageHandlerRegistry, featureRegistry: FeatureRegistry): void
}
