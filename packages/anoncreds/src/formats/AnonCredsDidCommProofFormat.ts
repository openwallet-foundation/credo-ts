import type { DidCommProofFormat } from '@credo-ts/didcomm'
import type {
  AnonCredsNonRevokedInterval,
  AnonCredsPredicateType,
  AnonCredsProof,
  AnonCredsProofRequest,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicate,
  AnonCredsRequestedPredicateMatch,
  AnonCredsSelectedCredentials,
} from '../models'

export interface AnonCredsPresentationPreviewAttribute {
  name: string
  credentialDefinitionId?: string
  mimeType?: string
  value?: string
  referent?: string
}

export interface AnonCredsPresentationPreviewPredicate {
  name: string
  credentialDefinitionId: string
  predicate: AnonCredsPredicateType
  threshold: number
}

/**
 * Interface for creating an anoncreds proof proposal.
 */
export interface AnonCredsProposeProofFormat {
  name?: string
  version?: string
  attributes?: AnonCredsPresentationPreviewAttribute[]
  predicates?: AnonCredsPresentationPreviewPredicate[]
  nonRevokedInterval?: AnonCredsNonRevokedInterval
}

/**
 * Interface for creating an anoncreds proof request.
 */
export interface AnonCredsRequestProofFormat {
  name: string
  version: string
  non_revoked?: AnonCredsNonRevokedInterval
  requested_attributes?: Record<string, AnonCredsRequestedAttribute>
  requested_predicates?: Record<string, AnonCredsRequestedPredicate>

  /**
   * Optional nonce for the proof request. If not provided, a secure random
   * nonce is auto-generated. Must be a non-negative integer as a decimal string
   * (per the AnonCreds specification). Useful for multi-step protocols or
   * ceremony flows where the verifier needs to bind the proof to a specific
   * challenge.
   */
  nonce?: string
}

/**
 * Interface for getting credentials for an indy proof request.
 */
export interface AnonCredsCredentialsForProofRequest {
  attributes: Record<string, AnonCredsRequestedAttributeMatch[]>
  predicates: Record<string, AnonCredsRequestedPredicateMatch[]>
}

export interface AnonCredsGetCredentialsForProofRequestOptions {
  filterByNonRevocationRequirements?: boolean
}

export interface AnonCredsDidCommProofFormat extends DidCommProofFormat {
  formatKey: 'anoncreds'

  proofFormats: {
    createProposal: AnonCredsProposeProofFormat
    acceptProposal: {
      name?: string
      version?: string
    }
    createRequest: AnonCredsRequestProofFormat
    acceptRequest: AnonCredsSelectedCredentials

    getCredentialsForRequest: {
      input: AnonCredsGetCredentialsForProofRequestOptions
      output: AnonCredsCredentialsForProofRequest
    }
    selectCredentialsForRequest: {
      input: AnonCredsGetCredentialsForProofRequestOptions
      output: AnonCredsSelectedCredentials
    }
  }

  formatData: {
    proposal: AnonCredsProofRequest
    request: AnonCredsProofRequest
    presentation: AnonCredsProof
  }
}
