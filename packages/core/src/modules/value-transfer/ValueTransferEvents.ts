import type { BaseEvent } from '../../agent/Events'
import type { ValueTransferState } from './ValueTransferState'
import type { ValueTransferRecord } from './repository'
import type { WitnessData } from '@aries-framework/core'

export enum ValueTransferEventTypes {
  ValueTransferStateChanged = 'ValueTransferStateChanged',
  ResumeTransaction = 'ResumeTransaction',
  WitnessTableReceived = 'WitnessTableReceived',
}

export interface ValueTransferStateChangedEvent extends BaseEvent {
  type: typeof ValueTransferEventTypes.ValueTransferStateChanged
  payload: {
    record: ValueTransferRecord
    previousState?: ValueTransferState | null
  }
}

export interface ResumeValueTransferTransactionEvent extends BaseEvent {
  type: typeof ValueTransferEventTypes.ResumeTransaction
  payload: {
    thid: string
  }
}

export interface WitnessTableReceivedEvent extends BaseEvent {
  type: typeof ValueTransferEventTypes.WitnessTableReceived
  payload: {
    witnesses: WitnessData[]
  }
}
