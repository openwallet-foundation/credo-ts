import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'

/**
 * The states in which an issuance session accepts a credential request.
 */
export const credentialRequestStates = [
  // OfferUriRetrieved is valid when doing auth flow (we should add a check)
  OpenId4VcIssuanceSessionState.OfferUriRetrieved,
  OpenId4VcIssuanceSessionState.AccessTokenCreated,
  OpenId4VcIssuanceSessionState.CredentialRequestReceived,
  // It is possible to issue multiple credentials in one session
  OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued,
]

/**
 * All states except the finished `Completed` and `Error` states. A finished session is never changed again.
 */
const finishedStates = [OpenId4VcIssuanceSessionState.Error, OpenId4VcIssuanceSessionState.Completed]
export const unfinishedStates = Object.values(OpenId4VcIssuanceSessionState).filter(
  (state) => !finishedStates.includes(state)
)
