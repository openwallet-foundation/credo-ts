import type { BaseEvent } from '../../agent/Events'
import type { Routing } from '../connections'
import type { MediationState } from './models/MediationState'
import type { KeylistUpdate } from './protocol/coordinate-mediation/v1/messages/KeylistUpdateMessage'
import type { DidListUpdate } from './protocol/coordinate-mediation/v2/messages/KeyListUpdateMessage'
import type { MediationRecord } from './repository/MediationRecord'

export enum RoutingEventTypes {
  MediationStateChanged = 'MediationStateChanged',
  RecipientKeylistUpdated = 'RecipientKeylistUpdated',
  RecipientDidlistUpdated = 'RecipientDidlistUpdated',
  RoutingCreatedEvent = 'RoutingCreatedEvent',
}

export interface RoutingCreatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.RoutingCreatedEvent
  payload: {
    routing: Routing
  }
}

export interface MediationStateChangedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationStateChanged
  payload: {
    mediationRecord: MediationRecord
    previousState: MediationState | null
  }
}

export interface KeylistUpdatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.RecipientKeylistUpdated
  payload: {
    mediationRecord: MediationRecord
    keylist: KeylistUpdate[]
  }
}

export interface DidlistUpdatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.RecipientDidlistUpdated
  payload: {
    mediationRecord: MediationRecord
    didlist: DidListUpdate[]
  }
}
