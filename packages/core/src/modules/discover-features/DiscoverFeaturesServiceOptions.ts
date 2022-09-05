import type { AgentMessage } from '../../agent/AgentMessage'
import type { FeatureQueryOptions } from './models'

export interface CreateQueryOptions {
  queries: FeatureQueryOptions[]
  comment?: string
}

export interface CreateDisclosureOptions {
  queries: FeatureQueryOptions[]
  threadId?: string
}

export interface DiscoverFeaturesProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
}
