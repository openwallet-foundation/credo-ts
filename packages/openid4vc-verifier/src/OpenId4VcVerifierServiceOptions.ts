import type { VerificationMethod } from '@aries-framework/core'
import type {
  IDTokenPayload,
  VerifiedOpenID4VPSubmission,
  ClientMetadataOpts,
  AuthorizationResponsePayload,
} from '@sphereon/did-auth-siop'
import type { IPresentationDefinition } from '@sphereon/pex'

import { ResponseType, PassBy, Scope, SigningAlgo, SubjectType } from '@sphereon/did-auth-siop'

export type HolderClientMetadata = ClientMetadataOpts & { authorization_endpoint?: string }

export interface CreateProofRequestOptions {
  verificationMethod: VerificationMethod
  redirectUri: string
  holderClientMetadata?: HolderClientMetadata
  issuer?: string
  presentationDefinition?: IPresentationDefinition
}

export type ProofRequest = string

export interface ProofRequestMetadata {
  correlationId: string
  challenge: string
  state: string
}

export type ProofRequestWithMetadata = {
  proofRequest: ProofRequest
  proofRequestMetadata: ProofRequestMetadata
}

export interface VerifyProofResponseOptions {
  createProofRequestOptions: CreateProofRequestOptions
  proofRequestMetadata: ProofRequestMetadata
}

export interface VerifiedProofResponse {
  idTokenPayload: IDTokenPayload
  submission: VerifiedOpenID4VPSubmission | undefined
}

export type ProofPayload = AuthorizationResponsePayload

export const staticOpSiopConfig: HolderClientMetadata = {
  authorization_endpoint: 'siopv2:',
  subject_syntax_types_supported: ['urn:ietf:params:oauth:jwk-thumbprint'],
  responseTypesSupported: [ResponseType.ID_TOKEN],
  scopesSupported: [Scope.OPENID],
  subjectTypesSupported: [SubjectType.PAIRWISE],
  idTokenSigningAlgValuesSupported: [SigningAlgo.ES256],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.ES256],
  passBy: PassBy.VALUE,
}

export const staticOpOpenIdConfig: HolderClientMetadata = {
  authorization_endpoint: 'openid:',
  subject_syntax_types_supported: ['urn:ietf:params:oauth:jwk-thumbprint'],
  responseTypesSupported: [ResponseType.ID_TOKEN, ResponseType.VP_TOKEN],
  scopesSupported: [Scope.OPENID],
  subjectTypesSupported: [SubjectType.PAIRWISE],
  idTokenSigningAlgValuesSupported: [SigningAlgo.ES256],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.ES256],
  passBy: PassBy.VALUE,
  vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.ES256] }, jwt_vp: { alg: [SigningAlgo.ES256] } },
}
