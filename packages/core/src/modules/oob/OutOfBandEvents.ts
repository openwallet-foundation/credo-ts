import type { BaseEvent } from '../../agent/Events'
import type { OutOfBandState } from './OutOfBandState'
import type { OutOfBandRecord } from './repository'

export enum OutOfBandEventTypes {
  OutOfBandStateChanged = 'OutOfBandStateChanged',
}
export interface OutOfBandEventStateChangedEvent extends BaseEvent {
  type: typeof OutOfBandEventTypes.OutOfBandStateChanged
  payload: {
    outOfBandRecord: OutOfBandRecord
    previousState?: OutOfBandState | null
  }
}
