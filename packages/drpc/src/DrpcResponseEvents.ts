import type { BaseEvent } from '@credo-ts/core'
import type { DrpcRecord } from './repository'

export enum DrpcResponseEventTypes {
  DrpcResponseStateChanged = 'DrpcResponseStateChanged',
}
export interface DrpcResponseStateChangedEvent extends BaseEvent {
  type: typeof DrpcResponseEventTypes.DrpcResponseStateChanged
  payload: {
    drpcMessageRecord: DrpcRecord
  }
}
