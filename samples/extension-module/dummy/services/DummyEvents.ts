import type { DummyRecord } from '../repository/DummyRecord'
import type { DummyState } from '../repository/DummyState'
import type { BaseEvent } from '@credo-ts/core'

export enum DummyEventTypes {
  StateChanged = 'DummyStateChanged',
}

export interface DummyStateChangedEvent extends BaseEvent {
  type: DummyEventTypes.StateChanged
  payload: {
    dummyRecord: DummyRecord
    previousState: DummyState | null
  }
}
