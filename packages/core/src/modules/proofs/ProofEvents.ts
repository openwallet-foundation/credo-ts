import type { BaseEvent } from '../../agent/Events'
import type { ProofState } from './ProofState'
import type { ProofRecord } from './repository'

export enum ProofEventTypes {
  ProofStateChanged = 'ProofStateChanged',
  ProofDeleted = 'ProofDeleted',
}

export interface ProofStateChangedEvent extends BaseEvent {
  type: typeof ProofEventTypes.ProofStateChanged
  payload: {
    proofRecord: ProofRecord
    previousState: ProofState | null
  }
}
export interface ProofDeletedEvent extends BaseEvent {
  type: typeof ProofEventTypes.ProofDeleted
  payload: {
    proofRecord: ProofRecord
  }
}
