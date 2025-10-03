import type { BaseEvent } from '@credo-ts/core'
import type { DidCommProofState } from './models/DidCommProofState'
import type { DidCommProofExchangeRecord } from './repository'

export enum DidCommProofEventTypes {
  ProofStateChanged = 'DidCommProofStateChanged',
}

export interface DidCommProofStateChangedEvent extends BaseEvent {
  type: typeof DidCommProofEventTypes.ProofStateChanged
  payload: {
    proofRecord: DidCommProofExchangeRecord
    previousState: DidCommProofState | null
  }
}
