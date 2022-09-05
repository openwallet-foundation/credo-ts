import type { BaseEvent } from '../../agent/Events'
import type { ConnectionRecord } from '../connections'
import type { Feature, FeatureQueryOptions } from './models'

export enum DiscoverFeaturesEventTypes {
  QueryReceived = 'QueryReceived',
  DisclosureReceived = 'DisclosureReceived',
}

export interface DiscoverFeaturesQueryReceivedEvent extends BaseEvent {
  type: typeof DiscoverFeaturesEventTypes.QueryReceived
  payload: {
    queries: FeatureQueryOptions[]
    protocolVersion: string
    connection: ConnectionRecord
    threadId: string
  }
}

export interface DiscoverFeaturesDisclosureReceivedEvent extends BaseEvent {
  type: typeof DiscoverFeaturesEventTypes.DisclosureReceived
  payload: {
    disclosures: Feature[]
    protocolVersion: string
    connection: ConnectionRecord
    threadId: string
  }
}
