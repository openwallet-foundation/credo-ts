import type { DRPCMessageRecord } from './repository'
import type { BaseEvent } from '../../agent/Events'

export enum DRPCRequestEventTypes {
  DRPCRequestStateChanged = 'DRPCRequestStateChanged',
}
export interface DRPCRequestStateChangedEvent extends BaseEvent {
  type: typeof DRPCRequestEventTypes.DRPCRequestStateChanged
  payload: {
    drpcMessageRecord: DRPCMessageRecord
  }
}
