import type { BaseEvent } from '@credo-ts/core'
import type { OpenId4VcVerificationSessionState } from './OpenId4VcVerificationSessionState'
import type { OpenId4VpVerifiedAuthorizationResponse } from './OpenId4VpVerifierServiceOptions'
import type { OpenId4VcVerificationSessionRecord } from './repository'

export enum OpenId4VcVerifierEvents {
  VerificationSessionStateChanged = 'OpenId4VcVerifier.VerificationSessionStateChanged',
}

export interface OpenId4VcVerificationSessionStateChangedEvent extends BaseEvent {
  type: typeof OpenId4VcVerifierEvents.VerificationSessionStateChanged
  payload: {
    verificationSession: OpenId4VcVerificationSessionRecord
    previousState: OpenId4VcVerificationSessionState | null

    /**
     * The verified authorization response. Only set when the session moved to `ResponseVerified`
     * while verifying the response. It has the presentations as verified, including type metadata
     * resolved during verification, so it doesn't need to be fetched again with
     * `getVerifiedAuthorizationResponse`.
     */
    verifiedAuthorizationResponse?: Omit<OpenId4VpVerifiedAuthorizationResponse, 'verificationSession'>
  }
}
