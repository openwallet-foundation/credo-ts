import type { DRPCMessageRecord } from './repository'
import type { BaseEvent } from '@credo-ts/core'

export enum DRPCRequestEventTypes {
  DRPCRequestStateChanged = 'DRPCRequestStateChanged',
}
export interface DRPCRequestStateChangedEvent extends BaseEvent {
  type: typeof DRPCRequestEventTypes.DRPCRequestStateChanged
  payload: {
    drpcMessageRecord: DRPCMessageRecord
  }
}
