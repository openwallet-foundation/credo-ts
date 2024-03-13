import type { OpenId4VcVerificationSessionState } from './OpenId4VcVerificationSessionState'
import type { OpenId4VcVerificationSessionRecord } from './repository'
import type { BaseEvent } from '@credo-ts/core'

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
