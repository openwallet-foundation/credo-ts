import type { DifPexCredentialsForRequest } from '@aries-framework/core/src'
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
  credentialsForRequest: DifPexCredentialsForRequest
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
