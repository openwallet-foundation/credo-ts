import type { BaseEvent } from '../../agent/Events'
import type { ProofRecord } from './ProofRecord'
import type { ProofState } from './ProofState'

export enum ProofEventTypes {
  ProofStateChanged = 'ProofStateChanged',
}

export interface ProofStateChangedEvent extends BaseEvent {
  type: typeof ProofEventTypes.ProofStateChanged
  payload: {
    proofRecord: ProofRecord
    previousState: ProofState | null
  }
}
