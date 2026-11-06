import type { BaseEvent } from '../../agent/Events'
import type { MdocVerificationSessionState } from './MdocVerificationSessionState'
import type { MdocVerificationSessionRecord } from './repository'

export enum MdocEventTypes {
  MdocVerificationSessionStateChanged = 'Mdoc.VerificationSessionStateChanged',
}

export interface MdocVerificationSessionStateChangedEvent extends BaseEvent {
  type: typeof MdocEventTypes.MdocVerificationSessionStateChanged
  payload: {
    verificationSession: MdocVerificationSessionRecord
    previousState: MdocVerificationSessionState | null
  }
}
