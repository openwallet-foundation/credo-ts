import type { VerificationMethod } from '@aries-framework/core'
import type { PresentationDefinitionV1, PresentationDefinitionV2 } from '@sphereon/pex-models'

import {
  type IDTokenPayload,
  type VerifiedOpenID4VPSubmission,
  type ClientMetadataOpts,
  type AuthorizationResponsePayload,
  ResponseType,
  Scope,
  PassBy,
  SigningAlgo,
  SubjectType,
} from '@sphereon/did-auth-siop'

export { PassBy, SigningAlgo, SubjectType, ResponseType, Scope } from '@sphereon/did-auth-siop'

export type HolderMetadata = ClientMetadataOpts & { authorization_endpoint?: string }

export type { PresentationDefinitionV1, PresentationDefinitionV2, VerifiedOpenID4VPSubmission, IDTokenPayload }

export interface CreateProofRequestOptions {
  verificationMethod: VerificationMethod
  redirectUri: string
  holderMetadata?: HolderMetadata
  holderIdentifier?: string
  presentationDefinition?: PresentationDefinitionV1 | PresentationDefinitionV2
}

export interface ProofRequestMetadata {
  correlationId: string
  challenge: string
  state: string
}

export type ProofRequestWithMetadata = {
  proofRequest: string
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

export const staticOpSiopConfig: HolderMetadata = {
  authorization_endpoint: 'siopv2:',
  subject_syntax_types_supported: ['urn:ietf:params:oauth:jwk-thumbprint'],
  responseTypesSupported: [ResponseType.ID_TOKEN],
  scopesSupported: [Scope.OPENID],
  subjectTypesSupported: [SubjectType.PAIRWISE],
  idTokenSigningAlgValuesSupported: [SigningAlgo.ES256],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.ES256],
  passBy: PassBy.VALUE,
}

export const staticOpOpenIdConfig: HolderMetadata = {
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
