import type { BaseEvent } from '../../agent/Events'
import type { Feature, FeatureQueryOptions } from '../../agent/models'
import type { DidCommV1Message, DidCommV2Message } from '../../didcomm'
import type { ConnectionRecord } from '../connections'

export enum DiscoverFeaturesEventTypes {
  QueryReceived = 'QueryReceived',
  DisclosureReceived = 'DisclosureReceived',
}

export interface DiscoverFeaturesQueryReceivedEvent extends BaseEvent {
  type: typeof DiscoverFeaturesEventTypes.QueryReceived
  payload: {
    message: DidCommV1Message | DidCommV2Message
    queries: FeatureQueryOptions[]
    protocolVersion: string
    connection: ConnectionRecord
    threadId: string
  }
}

export interface DiscoverFeaturesDisclosureReceivedEvent extends BaseEvent {
  type: typeof DiscoverFeaturesEventTypes.DisclosureReceived
  payload: {
    message: DidCommV1Message | DidCommV2Message
    disclosures: Feature[]
    protocolVersion: string
    connection: ConnectionRecord
    threadId: string
  }
}
