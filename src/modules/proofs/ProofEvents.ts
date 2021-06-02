import { BaseEvent } from '../../agent/Events'
import { ProofState } from './ProofState'
import { ProofRecord } from './repository'

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
