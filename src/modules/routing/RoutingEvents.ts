import type { Verkey } from 'indy-sdk'
import { BaseEvent } from '../../agent/Events'
import { ConnectionRecord } from '../connections'
import { MediationState } from './models/MediationState'
import { MediationRecord } from './repository/MediationRecord'

export enum RoutingEventTypes {
  MediationStateChanged = 'MediationStateChanged',
  MediationGranted = 'MediationGranted',
}

export interface MediationGrantedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationGranted
  payload: {
    connectionRecord: ConnectionRecord
    endpoint: string
    routingKeys: Verkey[]
  }
}

export interface MediationStateChangedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationStateChanged
  payload: {
    mediationRecord: MediationRecord
    previousState: MediationState
  }
}
