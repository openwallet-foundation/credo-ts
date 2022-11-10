import type { BaseEvent } from '../../agent/Events'
import type { DIDCommV1Message } from '../../agent/didcomm'
import type { Feature, FeatureQueryOptions } from '../../agent/models'
import type { ConnectionRecord } from '../connections'

export enum DiscoverFeaturesEventTypes {
  QueryReceived = 'QueryReceived',
  DisclosureReceived = 'DisclosureReceived',
}

export interface DiscoverFeaturesQueryReceivedEvent extends BaseEvent {
  type: typeof DiscoverFeaturesEventTypes.QueryReceived
  payload: {
    message: DIDCommV1Message
    queries: FeatureQueryOptions[]
    protocolVersion: string
    connection: ConnectionRecord
    threadId: string
  }
}

export interface DiscoverFeaturesDisclosureReceivedEvent extends BaseEvent {
  type: typeof DiscoverFeaturesEventTypes.DisclosureReceived
  payload: {
    message: DIDCommV1Message
    disclosures: Feature[]
    protocolVersion: string
    connection: ConnectionRecord
    threadId: string
  }
}
