import type { DidCommProofFormat } from '@credo-ts/didcomm'
import type {
  AnonCredsCredentialsForProofRequest,
  AnonCredsGetCredentialsForProofRequestOptions,
  AnonCredsNonRevokedInterval,
  AnonCredsPresentationPreviewAttribute,
  AnonCredsPresentationPreviewPredicate,
  AnonCredsProof,
  AnonCredsProofRequest,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedPredicate,
  AnonCredsSelectedCredentials,
} from '../models'

export type {
  AnonCredsCredentialsForProofRequest,
  AnonCredsGetCredentialsForProofRequestOptions,
  AnonCredsPresentationPreviewAttribute,
  AnonCredsPresentationPreviewPredicate,
} from '../models'

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
   * nonce is auto-generated.
   *
   * Must be a non-negative integer encoded as a decimal string, at most 80 bits
   * (i.e. the decimal value must be < 2^80). This matches the `LARGE_NONCE`
   * constant in the AnonCreds CL-signatures specification.
   *
   * @see https://github.com/anoncreds/anoncreds-clsignatures-rs/blob/5c74d040e842c25d8e9a05ca65dee6fb277a9be0/src/constants.rs#L25
   */
  nonce?: string
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
