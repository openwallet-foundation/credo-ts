import type { ProofAttributeInfoOptions, ProofPredicateInfoOptions } from './models'
import type { RequestedAttributeOptions } from './models/RequestedAttribute'
import type { RequestedPredicateOptions } from './models/RequestedPredicate'
import type { V1PresentationPreviewAttributeOptions, V1PresentationPreviewPredicateOptions } from '../../protocol/v1'
import type { ProofFormat } from '../ProofFormat'
import type { IndyProof, IndyProofRequest } from 'indy-sdk'

/**
 * Interface for creating an indy proof proposal.
 */
export interface IndyProposeProofFormat {
  name?: string
  version?: string
  attributes?: V1PresentationPreviewAttributeOptions[]
  predicates?: V1PresentationPreviewPredicateOptions[]
}

/**
 * Interface for creating an indy proof request.
 */
export interface IndyRequestProofFormat {
  name: string
  version: string
  // TODO: update to AnonCredsNonRevokedInterval when moving to AnonCreds package
  nonRevoked?: { from?: number; to?: number }
  requestedAttributes?: Record<string, ProofAttributeInfoOptions>
  requestedPredicates?: Record<string, ProofPredicateInfoOptions>
}

/**
 * Interface for accepting an indy proof request.
 */
export type IndyAcceptProofRequestFormat = Partial<IndySelectedCredentialsForProofRequest>

export interface IndySelectedCredentialsForProofRequest {
  requestedAttributes: Record<string, RequestedAttributeOptions>
  requestedPredicates: Record<string, RequestedPredicateOptions>
  selfAttestedAttributes: Record<string, string>
}

/**
 * Interface for getting credentials for an indy proof request.
 */
export interface IndyCredentialsForProofRequest {
  attributes: Record<string, RequestedAttributeOptions[]>
  predicates: Record<string, RequestedPredicateOptions[]>
}

export interface IndyGetCredentialsForProofRequestOptions {
  filterByNonRevocationRequirements?: boolean
}

export interface IndyProofFormat extends ProofFormat {
  formatKey: 'indy'

  proofFormats: {
    createProposal: IndyProposeProofFormat
    acceptProposal: {
      name?: string
      version?: string
    }
    createRequest: IndyRequestProofFormat
    acceptRequest: IndyAcceptProofRequestFormat

    getCredentialsForRequest: {
      input: IndyGetCredentialsForProofRequestOptions
      output: IndyCredentialsForProofRequest
    }
    selectCredentialsForRequest: {
      input: IndyGetCredentialsForProofRequestOptions
      output: IndySelectedCredentialsForProofRequest
    }
  }

  formatData: {
    proposal: IndyProofRequest
    request: IndyProofRequest
    presentation: IndyProof
  }
}
