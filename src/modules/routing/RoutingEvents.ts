import type { Verkey } from 'indy-sdk'
import { MediationGrantMessage, KeylistUpdateMessage} from '.'

import { BaseEvent } from '../../agent/Events'
import { KeylistUpdated, KeylistUpdateResponseMessage } from './messages/KeylistUpdateResponseMessage'
import { MediationState } from './models/MediationState'
import { MediationRecord } from './repository/MediationRecord'

export enum RoutingEventTypes {
  MediationStateChanged = 'MediationStateChanged',
  MediationGranted = 'MediationGranted',
  MediationKeylist = 'MediationKeylist',
  MediationKeylistUpdate = 'MediationKeylistUpdate',
  MediationKeylistUpdated = 'MediationKeylistUpdated',
}

export interface MediationGrantedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationGranted
  payload: {
    mediationRecord: MediationRecord
    message: MediationGrantMessage
  }
}

export interface MediationStateChangedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationStateChanged
  payload: {
    mediationRecord: MediationRecord
    previousState: MediationState
  }
}

export interface MediationKeylistEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationKeylist
  payload: {
    mediationRecord: MediationRecord
    keylist: KeylistUpdated[]
  }
}

export interface MediationKeylistUpdatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationKeylistUpdated
  payload: {
    mediationRecord: MediationRecord
    message: KeylistUpdateResponseMessage
  }
}

export interface KeylistUpdateEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationKeylistUpdate
  payload: {
    mediationRecord: MediationRecord
    message: KeylistUpdateMessage
  }
}

export interface KeylistUpdatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationKeylistUpdated
  payload: {
    mediationRecord: MediationRecord
    keylist: KeylistUpdated[]
  }
}
