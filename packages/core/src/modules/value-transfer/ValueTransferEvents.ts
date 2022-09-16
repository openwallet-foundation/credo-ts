import type { BaseEvent } from '../../agent/Events'
import type { WitnessData } from './messages'
import type { ValueTransferRecord } from './repository'
import type { TransactionState } from '@sicpa-dlab/value-transfer-protocol-ts'

export enum ValueTransferEventTypes {
  ValueTransferStateChanged = 'ValueTransferStateChanged',
  ResumeTransaction = 'ResumeTransaction',
  WitnessTableReceived = 'WitnessTableReceived',
  CashMinted = 'CashMinted',
}

export interface ValueTransferStateChangedEvent extends BaseEvent {
  type: typeof ValueTransferEventTypes.ValueTransferStateChanged
  payload: {
    record: ValueTransferRecord
    previousState?: TransactionState | null
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

export interface CashMintedEvent extends BaseEvent {
  type: typeof ValueTransferEventTypes.CashMinted
}
