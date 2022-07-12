import type { BaseEvent } from '../../agent/Events'
import type { DidRecord } from './repository'

export enum DidEventTypes {
  DidReceived = 'DidReceived',
  DidMetadataChanged = 'DidMetadataChanged',
}
export interface DidReceivedEvent extends BaseEvent {
  type: typeof DidEventTypes.DidReceived
  payload: {
    record: DidRecord
  }
}
export interface DidMetadataChangedEvent extends BaseEvent {
  type: typeof DidEventTypes.DidMetadataChanged
  payload: {
    record: DidRecord
  }
}
