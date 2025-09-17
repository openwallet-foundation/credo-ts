import type { BaseEvent } from '@credo-ts/core'
import type { DidCommRouting } from '../../models'
import type { KeylistUpdate } from './messages/KeylistUpdateMessage'
import type { DidCommMediationState } from './models/DidCommMediationState'
import type { DidCommMediationRecord } from './repository/DidCommMediationRecord'

export enum DidCommRoutingEventTypes {
  MediationStateChanged = 'DidCommMediationStateChanged',
  RecipientKeylistUpdated = 'DidCommRecipientKeylistUpdated',
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
    keylist: KeylistUpdate[]
  }
}
