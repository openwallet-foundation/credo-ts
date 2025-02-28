import type { BaseEvent } from '@credo-ts/core'
import type { OpenId4VcVerificationSessionState } from './OpenId4VcVerificationSessionState'
import type { OpenId4VcVerificationSessionRecord } from './repository'

export enum OpenId4VcVerifierEvents {
  VerificationSessionStateChanged = 'OpenId4VcVerifier.VerificationSessionStateChanged',
}

export interface OpenId4VcVerificationSessionStateChangedEvent extends BaseEvent {
  type: typeof OpenId4VcVerifierEvents.VerificationSessionStateChanged
  payload: {
    verificationSession: OpenId4VcVerificationSessionRecord
    previousState: OpenId4VcVerificationSessionState | null
  }
}
