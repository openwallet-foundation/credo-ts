import type { FeatureQueryOptions } from '../../agent/models'
import type { DidCommV1Message } from '../../didcomm'

export interface CreateQueryOptions {
  queries: FeatureQueryOptions[]
  comment?: string
}

export interface CreateDisclosureOptions {
  disclosureQueries: FeatureQueryOptions[]
  threadId?: string
}

export interface DiscoverFeaturesProtocolMsgReturnType<MessageType extends DidCommV1Message> {
  message: MessageType
}
