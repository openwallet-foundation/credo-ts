import type { BaseEvent } from '../../agent/Events'
import type { ValueTransferRecord } from './repository'
import { ValueTransferState } from './ValueTransferState'

export enum ValueTransferEventTypes {
  ValueTransferStateChanged = 'ValueTransferStateChanged',
}
export interface ValueTransferStateChangedEvent extends BaseEvent {
  type: typeof ValueTransferEventTypes.ValueTransferStateChanged
  payload: {
    message: ValueTransferRecord
    previousState: ValueTransferState | null
  }
}
