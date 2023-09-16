import type { AgentBaseMessage } from '../../agent/AgentBaseMessage'
import type { FeatureQueryOptions } from '../../agent/models'
import type { ConnectionRecord } from '../connections'

export interface CreateQueryOptions {
  connectionRecord?: ConnectionRecord
  queries: FeatureQueryOptions[]
  comment?: string
}

export interface CreateDisclosureOptions {
  connectionRecord?: ConnectionRecord
  disclosureQueries: FeatureQueryOptions[]
  threadId?: string
}

export interface DiscoverFeaturesProtocolMsgReturnType<MessageType extends AgentBaseMessage> {
  message: MessageType
}
