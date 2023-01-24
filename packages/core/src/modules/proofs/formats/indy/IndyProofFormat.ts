import type { RequestedAttribute } from './models/RequestedAttribute'
import type { IndyRequestedCredentialsOptions } from './models/RequestedCredentials'
import type { RequestedPredicate } from './models/RequestedPredicate'
import type { PresentationPreviewAttribute, PresentationPreviewPredicate } from '../../protocol/v1'
import type { ProofFormat } from '../ProofFormat'
import type { IndyRequestProofFormat } from '../indy/IndyProofFormatsServiceOptions'
import type { IndyProof, IndyProofRequest } from 'indy-sdk'

export interface IndyProposeProofFormat {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
  nonce?: string
  name?: string
  version?: string
}

export interface IndyRequestedCredentialsFormat {
  requestedAttributes: Record<string, RequestedAttribute>
  requestedPredicates: Record<string, RequestedPredicate>
  selfAttestedAttributes: Record<string, string>
}

export interface IndyRetrievedCredentialsFormat {
  requestedAttributes: Record<string, RequestedAttribute[]>
  requestedPredicates: Record<string, RequestedPredicate[]>
}

export interface IndyProofFormat extends ProofFormat {
  formatKey: 'indy'
  proofRecordType: 'indy'
  proofFormats: {
    createProposal: IndyProposeProofFormat
    acceptProposal: unknown
    createRequest: IndyRequestProofFormat
    acceptRequest: unknown
    createPresentation: IndyRequestedCredentialsOptions
    acceptPresentation: unknown
    createProposalAsResponse: IndyProposeProofFormat
    createOutOfBandRequest: unknown
    createRequestAsResponse: IndyRequestProofFormat
    createProofRequestFromProposal: IndyRequestProofFormat
    requestCredentials: IndyRequestedCredentialsFormat
    retrieveCredentials: IndyRetrievedCredentialsFormat
  }

  formatData: {
    proposal: IndyProofRequest
    request: IndyProofRequest
    presentation: IndyProof
  }
}
