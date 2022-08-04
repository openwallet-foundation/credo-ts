import type { BaseEvent } from '../../agent/Events'
import type { ValueTransferState } from './ValueTransferState'
import type { ValueTransferRecord, WitnessData } from './repository'

export enum ValueTransferEventTypes {
  ValueTransferStateChanged = 'ValueTransferStateChanged',
  WitnessTableReceived = 'WitnessTableReceived',
}

export interface ValueTransferStateChangedEvent extends BaseEvent {
  type: typeof ValueTransferEventTypes.ValueTransferStateChanged
  payload: {
    record: ValueTransferRecord
    previousState?: ValueTransferState | null
  }
}

export interface WitnessTableReceivedEvent extends BaseEvent {
  type: typeof ValueTransferEventTypes.WitnessTableReceived
  payload: {
    witnesses: WitnessData[]
  }
}
