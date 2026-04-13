import type { BaseEvent } from '@credo-ts/core'
import type { DidCommRouting } from '../../models'
import type { DidCommKeylistUpdate } from './messages/DidCommKeylistUpdateMessage'
import type { DidCommMediationState } from './models/DidCommMediationState'
import type { DidCommMediationRecord } from './repository/DidCommMediationRecord'
import type { KeylistUpdateResponseItem } from './messages/v2/DidCommKeylistUpdateResponseV2Message'

export enum DidCommRoutingEventTypes {
  MediationStateChanged = 'DidCommMediationStateChanged',
  RecipientKeylistUpdated = 'DidCommRecipientKeylistUpdated',
  RecipientKeylistUpdatedV2 = 'DidCommRecipientKeylistUpdatedV2',
  RoutingCreatedEvent = 'DidCommRoutingCreatedEvent',
}

export interface DidCommRoutingCreatedEvent extends BaseEvent {
  type: typeof DidCommRoutingEventTypes.RoutingCreatedEvent
  payload: {
    routing: DidCommRouting
  }
}

export interface DidCommMediationStateChangedEvent extends BaseEvent {
  type: typeof DidCommRoutingEventTypes.MediationStateChanged
  payload: {
    mediationRecord: DidCommMediationRecord
    previousState: DidCommMediationState | null
  }
}

export interface DidCommKeylistUpdatedEvent extends BaseEvent {
  type: typeof DidCommRoutingEventTypes.RecipientKeylistUpdated
  payload: {
    mediationRecord: DidCommMediationRecord
    keylist: DidCommKeylistUpdate[]
  }
}

export interface DidCommKeylistUpdatedV2Event extends BaseEvent {
  type: typeof DidCommRoutingEventTypes.RecipientKeylistUpdatedV2
  payload: {
    mediationRecord: DidCommMediationRecord
    updated: KeylistUpdateResponseItem[]
  }
}
