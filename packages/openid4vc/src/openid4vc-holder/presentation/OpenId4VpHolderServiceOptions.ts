import type { PresentationSubmission } from './selection'
import type {
  AuthorizationResponsePayload,
  PresentationDefinitionWithLocation,
  VerifiedAuthorizationRequest,
} from '@sphereon/did-auth-siop'

export type AuthenticationRequest = VerifiedAuthorizationRequest

export type PresentationRequest = VerifiedAuthorizationRequest & {
  presentationDefinitions: [PresentationDefinitionWithLocation]
}

export function isVerifiedAuthorizationRequestWithPresentationDefinition(
  request: VerifiedAuthorizationRequest
): request is PresentationRequest {
  return (
    request.presentationDefinitions !== undefined &&
    request.presentationDefinitions.length === 1 &&
    request.presentationDefinitions?.[0]?.definition !== undefined
  )
}

export type ResolvedPresentationRequest = {
  proofType: 'presentation'
  presentationRequest: PresentationRequest
  presentationSubmission: PresentationSubmission
}

export type ResolvedAuthenticationRequest = {
  proofType: 'authentication'
  authenticationRequest: AuthenticationRequest
}

export type ResolvedProofRequest = ResolvedAuthenticationRequest | ResolvedPresentationRequest

export type ProofSubmissionResponse = {
  ok: boolean
  status: number
  submittedResponse: AuthorizationResponsePayload
}

export type VpFormat = 'jwt_vp' | 'ldp_vp'
