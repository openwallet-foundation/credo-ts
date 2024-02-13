import type { DrpcMessageRecord } from './repository'
import type { BaseEvent } from '@credo-ts/core'

export enum DrpcResponseEventTypes {
  DrpcResponseStateChanged = 'DrpcResponseStateChanged',
}
export interface DrpcResponseStateChangedEvent extends BaseEvent {
  type: typeof DrpcResponseEventTypes.DrpcResponseStateChanged
  payload: {
    drpcMessageRecord: DrpcMessageRecord
  }
}
