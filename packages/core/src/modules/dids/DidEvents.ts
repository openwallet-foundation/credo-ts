import type { BaseEvent } from '../../agent/Events'
import type { DidRecord } from './repository'

export enum DidEventTypes {
  DidReceived = 'DidReceived',
}
export interface DidReceivedEvent extends BaseEvent {
  type: typeof DidEventTypes.DidReceived
  payload: {
    record: DidRecord
  }
}
