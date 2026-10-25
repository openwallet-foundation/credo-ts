import type { BaseEvent } from '@credo-ts/core'
import type { OpenId4VcVerificationSessionState } from './OpenId4VcVerificationSessionState'
import type { OpenId4VpVerifiedAuthorizationResponse } from './OpenId4VpVerifierServiceOptions'
import type { OpenId4VcVerificationSessionRecord } from './repository'

export enum OpenId4VcVerifierEvents {
  VerificationSessionStateChanged = 'OpenId4VcVerifier.VerificationSessionStateChanged',
}

type OpenId4VcVerificationSessionStateChangedEventPayloadBase = {
  verificationSession: OpenId4VcVerificationSessionRecord
  previousState: OpenId4VcVerificationSessionState | null
}

/**
 * Narrow on `state` (the state of `verificationSession`) to get the `verifiedAuthorizationResponse`
 * of a `ResponseVerified` event.
 */
export type OpenId4VcVerificationSessionStateChangedEventPayload =
  | (OpenId4VcVerificationSessionStateChangedEventPayloadBase & {
      state: OpenId4VcVerificationSessionState.ResponseVerified

      /**
       * The authorization response as verified, including type metadata resolved during
       * verification, so it doesn't need to be fetched again with `getVerifiedAuthorizationResponse`.
       */
      verifiedAuthorizationResponse: Omit<OpenId4VpVerifiedAuthorizationResponse, 'verificationSession'>
    })
  | (OpenId4VcVerificationSessionStateChangedEventPayloadBase & {
      state: Exclude<OpenId4VcVerificationSessionState, OpenId4VcVerificationSessionState.ResponseVerified>
      verifiedAuthorizationResponse?: never
    })

export interface OpenId4VcVerificationSessionStateChangedEvent extends BaseEvent {
  type: typeof OpenId4VcVerifierEvents.VerificationSessionStateChanged
  payload: OpenId4VcVerificationSessionStateChangedEventPayload
}
