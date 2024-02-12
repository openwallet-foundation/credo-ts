import type { DRPCRequestMessage, DRPCResponseMessage } from './messages'
import type { DRPCMessageRecord } from './repository'
import type { BaseEvent } from '../../agent/Events'

export enum DRPCResponseEventTypes {
  DRPCResponseStateChanged = 'DRPCResponseStateChanged',
}
export interface DRPCResponseStateChangedEvent extends BaseEvent {
  type: typeof DRPCResponseEventTypes.DRPCResponseStateChanged
  payload: {
    drpcMessageRecord: DRPCMessageRecord
  }
}
