import type { PresentationSubmission, VerifiedAuthorizationRequestWithPresentationDefinition } from '..'
import type { AuthorizationResponsePayload, VerifiedAuthorizationRequest } from '@sphereon/did-auth-siop'

export type AuthenticationRequest = VerifiedAuthorizationRequest
export type PresentationRequest = VerifiedAuthorizationRequestWithPresentationDefinition

export type ResolvedProofRequest =
  | { proofType: 'authentication'; authenticationRequest: AuthenticationRequest }
  | {
      proofType: 'presentation'
      presentationRequest: PresentationRequest
      presentationSubmission: PresentationSubmission
    }

export type ProofSubmissionResponse = {
  ok: boolean
  status: number
  submittedResponse: AuthorizationResponsePayload
}

export type VpFormat = 'jwt_vp' | 'ldp_vp'
