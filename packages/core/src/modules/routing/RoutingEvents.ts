import type { BaseEvent } from '../../agent/Events'
import type { KeylistUpdate } from './messages/KeylistUpdateMessage'
import type { MediationState } from './models/MediationState'
import type { MediationRecord } from './repository/MediationRecord'

export enum RoutingEventTypes {
  MediationStateChanged = 'MediationStateChanged',
  RecipientKeylistUpdated = 'RecipientKeylistUpdated',
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
