import type { BaseEvent } from '@credo-ts/core'
import type { DidCommMessage } from '../../DidCommMessage'
import type { DidCommFeature, DidCommFeatureQueryOptions } from '../../models'
import type { ConnectionRecord } from '../connections'

export enum DiscoverFeaturesEventTypes {
  QueryReceived = 'QueryReceived',
  DisclosureReceived = 'DisclosureReceived',
}

export interface DiscoverFeaturesQueryReceivedEvent extends BaseEvent {
  type: typeof DiscoverFeaturesEventTypes.QueryReceived
  payload: {
    message: DidCommMessage
    queries: DidCommFeatureQueryOptions[]
    protocolVersion: string
    connection: ConnectionRecord
    threadId: string
  }
}

export interface DiscoverFeaturesDisclosureReceivedEvent extends BaseEvent {
  type: typeof DiscoverFeaturesEventTypes.DisclosureReceived
  payload: {
    message: DidCommMessage
    disclosures: DidCommFeature[]
    protocolVersion: string
    connection: ConnectionRecord
    threadId: string
  }
}
