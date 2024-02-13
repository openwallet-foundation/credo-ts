import type { DRPCMessageRecord } from './repository'
import type { BaseEvent } from '@credo-ts/core'

export enum DRPCResponseEventTypes {
  DRPCResponseStateChanged = 'DRPCResponseStateChanged',
}
export interface DRPCResponseStateChangedEvent extends BaseEvent {
  type: typeof DRPCResponseEventTypes.DRPCResponseStateChanged
  payload: {
    drpcMessageRecord: DRPCMessageRecord
  }
}
