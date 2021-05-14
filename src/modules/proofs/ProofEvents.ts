import { ProofState } from './ProofState'
import { ProofRecord } from './repository'

export interface ProofStateChangedEvent {
  type: 'ProofStateChanged'
  proofRecord: ProofRecord
  previousState: ProofState | null
}
