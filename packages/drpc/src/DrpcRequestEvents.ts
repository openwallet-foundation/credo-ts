import type { BaseEvent } from '@credo-ts/core'
import type { DrpcRecord } from './repository'

export enum DrpcRequestEventTypes {
  DrpcRequestStateChanged = 'DrpcRequestStateChanged',
}
export interface DrpcRequestStateChangedEvent extends BaseEvent {
  type: typeof DrpcRequestEventTypes.DrpcRequestStateChanged
  payload: {
    drpcMessageRecord: DrpcRecord
  }
}
