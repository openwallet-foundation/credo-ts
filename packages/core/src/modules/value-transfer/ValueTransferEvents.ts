import type { BaseEvent } from '../../agent/Events'
import type { ValueTransferState } from './ValueTransferState'
import type { ValueTransferRecord } from './repository'

export enum ValueTransferEventTypes {
  ValueTransferStateChanged = 'ValueTransferStateChanged',
}
export interface ValueTransferStateChangedEvent extends BaseEvent {
  type: typeof ValueTransferEventTypes.ValueTransferStateChanged
  payload: {
    record: ValueTransferRecord
    previousState?: ValueTransferState | null
  }
}
