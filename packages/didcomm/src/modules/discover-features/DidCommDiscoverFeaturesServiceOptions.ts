import type { DidCommMessage } from '../../DidCommMessage'
import type { DidCommFeatureQueryOptions } from '../../models'

export interface CreateQueryOptions {
  queries: DidCommFeatureQueryOptions[]
  comment?: string
}

export interface CreateDisclosureOptions {
  disclosureQueries: DidCommFeatureQueryOptions[]
  threadId?: string
}

export interface DiscoverFeaturesProtocolMsgReturnType<MessageType extends DidCommMessage> {
  message: MessageType
}
