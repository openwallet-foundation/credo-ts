import { KeylistUpdated } from './index'
import { BaseEvent } from '../../agent/Events'
import { MediationState } from './models/MediationState'
import { MediationRecord } from './repository/MediationRecord'
// TODO: clean up event names and structures
export enum RoutingEventTypes {
  MediationStateChanged = 'MediationStateChanged',
  RecipientKeylistUpdate = 'RecipientKeylistUpdate',
  RecipientKeylistUpdated = 'RecipientKeylistUpdated',
  Forward = 'Forward',
}

export interface MediationStateChangedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationStateChanged
  payload: {
    mediationRecord: MediationRecord
    previousState: MediationState
  }
}

export interface KeylistUpdatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.RecipientKeylistUpdated
  payload: {
    mediationRecord: MediationRecord
    keylist: KeylistUpdated[]
  }
}
