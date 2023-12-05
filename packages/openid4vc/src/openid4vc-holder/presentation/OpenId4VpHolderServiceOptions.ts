import type { PresentationSubmission } from './selection'
import type {
  AuthorizationResponsePayload,
  PresentationDefinitionWithLocation,
  VerifiedAuthorizationRequest,
} from '@sphereon/did-auth-siop'

export type AuthenticationRequest = VerifiedAuthorizationRequest

/**
 * SIOPv2 Authorization Request with a single v1 / v2 presentation definition
 */
export type PresentationRequest = VerifiedAuthorizationRequest & {
  presentationDefinitions: [PresentationDefinitionWithLocation]
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
