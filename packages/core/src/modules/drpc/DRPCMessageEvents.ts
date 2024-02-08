import type { DRPCRequestMessage, DRPCResponseMessage } from './messages'
import type { DRPCMessageRecord } from './repository'
import type { BaseEvent } from '../../agent/Events'

export enum DRPCMessageEventTypes {
  DRPCMessageStateChanged = 'DRPCMessageStateChanged',
}
export interface DRPCMessageStateChangedEvent extends BaseEvent {
  type: typeof DRPCMessageEventTypes.DRPCMessageStateChanged
  payload: {
    message: DRPCRequestMessage | DRPCResponseMessage
    drpcMessageRecord: DRPCMessageRecord
  }
}
