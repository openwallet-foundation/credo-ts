// T-TODO: move to indy module
import type { IndyRevocationInterval } from '../../../credentials'
import type {
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../../protocol/v1/models/V1PresentationPreview'
import type { ProofFormat } from '../ProofFormat'
import type {
  ProofAttributeInfo,
  ProofPredicateInfo,
  ProofRequest,
  RequestedAttribute,
  RequestedPredicate,
} from './models'

export interface IndyProposeProofFormat {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
  nonce: string
  name: string
  version: string
}

export interface IndyAcceptProposalFormat {
  // T-TODO: typing
  still: 'TODO'
}

export interface IndyRequestProofFormat {
  name: string
  version: string
  nonce: string
  nonRevoked?: IndyRevocationInterval
  ver?: '1.0' | '2.0'
  requestedAttributes?: Record<string, ProofAttributeInfo> | Map<string, ProofAttributeInfo>
  requestedPredicates?: Record<string, ProofPredicateInfo> | Map<string, ProofPredicateInfo>
  proofRequest?: ProofRequest
}

export interface IndyAcceptRequestFormat {
  requestedAttributes?: Record<string, RequestedAttribute>
  requestedPredicates?: Record<string, RequestedPredicate>
  selfAttestedAttributes?: Record<string, string>
}

export interface IndyProofFormat extends ProofFormat {
  formatKey: 'indy'
  proofFormats: {
    createProposal: IndyProposeProofFormat
    acceptProposal: IndyAcceptProposalFormat
    createRequest: IndyRequestProofFormat
    acceptRequest: IndyAcceptRequestFormat
  }
  formatData: {
    proposal: unknown
    request: unknown
    presentation: unknown
  }
}
