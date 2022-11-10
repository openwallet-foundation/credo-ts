import type { DIDCommV1Message } from '../../agent/didcomm'
import type { FeatureQueryOptions } from '../../agent/models'

export interface CreateQueryOptions {
  queries: FeatureQueryOptions[]
  comment?: string
}

export interface CreateDisclosureOptions {
  disclosureQueries: FeatureQueryOptions[]
  threadId?: string
}

export interface DiscoverFeaturesProtocolMsgReturnType<MessageType extends DIDCommV1Message> {
  message: MessageType
}
