import type { BaseEvent } from '@credo-ts/core'
import type { DidCommMessage } from '../../DidCommMessage'
import type { DidCommFeature, DidCommFeatureQueryOptions } from '../../models'
import type { DidCommConnectionRecord } from '../connections'

export enum DidCommDiscoverFeaturesEventTypes {
  QueryReceived = 'DidCommFeatureQueryReceived',
  DisclosureReceived = 'DidCommFeatureDisclosureReceived',
}

export interface DidCommDiscoverFeaturesQueryReceivedEvent extends BaseEvent {
  type: typeof DidCommDiscoverFeaturesEventTypes.QueryReceived
  payload: {
    message: DidCommMessage
    queries: DidCommFeatureQueryOptions[]
    protocolVersion: string
    connection: DidCommConnectionRecord
    threadId: string
  }
}

export interface DidCommDiscoverFeaturesDisclosureReceivedEvent extends BaseEvent {
  type: typeof DidCommDiscoverFeaturesEventTypes.DisclosureReceived
  payload: {
    message: DidCommMessage
    disclosures: DidCommFeature[]
    protocolVersion: string
    connection: DidCommConnectionRecord
    threadId: string
  }
}
