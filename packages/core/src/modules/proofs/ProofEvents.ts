import type { BaseEvent } from '../../agent/Events'
import type { ProofState } from './models/ProofState'
import type { ProofExchangeRecord } from './repository'

export enum ProofEventTypes {
  ProofStateChanged = 'ProofStateChanged',
}

export interface ProofStateChangedEvent extends BaseEvent {
  type: typeof ProofEventTypes.ProofStateChanged
  payload: {
    proofRecord: ProofExchangeRecord
    previousState: ProofState | null
  }
}
