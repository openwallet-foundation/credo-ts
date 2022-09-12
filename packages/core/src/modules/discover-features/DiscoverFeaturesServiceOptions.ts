import type { AgentMessage } from '../../agent/AgentMessage'
import type { FeatureQueryOptions } from '../../agent/models'

export interface CreateQueryOptions {
  queries: FeatureQueryOptions[]
  comment?: string
}

export interface CreateDisclosureOptions {
  disclosureQueries: FeatureQueryOptions[]
  threadId?: string
}

export interface DiscoverFeaturesProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
}
