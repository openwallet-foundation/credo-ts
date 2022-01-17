import type { ConnectionRecord } from '../../connections'
import type {
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../PresentationPreview'
import type { AutoAcceptProof } from '../ProofAutoAcceptType'
import type { ProofProtocolVersion } from '../ProofProtocolVersion'
import type { ProofRecord } from '../repository'
import type { ProofRequest, ProofRequestOptions } from '../v1/models'

export interface ProposeProofOptions {
  connectionId: string
  protocolVersion: ProofProtocolVersion
  proofFormats: V2ProposeProofFormat
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface AcceptProposalOptions {
  proofRecordId: string
  protocolVersion: ProofProtocolVersion
  proofFormats: {
    indy?: {
      attributes?: PresentationPreviewAttribute
      predicates?: PresentationPreviewPredicate
    }
    w3c?: {
      // TODO
    }
  }
  request?: ProofRequestsOptions
  comment?: string
}

export interface ProofRequestsOptions {
  nonce?: string
  name?: string
  version?: string
}

export interface ProposeProofFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyProposeProofFormat
  w3c?: W3CProofFormat
}

interface IndyProposeProofFormat {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
  nonce: string
  name: string
  version: string
  proofPreview?: PresentationPreview
}

export interface ProofRequestAsResponse {
  proofRecord: ProofRecord
  proofRequest: ProofRequest
  comment?: string
}

export interface W3CProofFormat {
  inputDescriptors: string
}

export interface V2ProposeProofFormat {
  indy?: IndyProposeProofFormat
  w3c?: {
    // TODO
  }
}

export interface PresentationConfig {
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export type CreateProofRequestOptions = Partial<
  Pick<ProofRequestOptions, 'name' | 'nonce' | 'requestedAttributes' | 'requestedPredicates'>
>

export interface RequestProofOptions {
  connectionId: string
  protocolVersion: ProofProtocolVersion
  proofFormats: V2ProposeProofFormat
  proofRequestOptions: CreateProofRequestOptions
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreateRequestOptions {
  proofRequest: ProofRequest
  connectionRecord?: ConnectionRecord
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export type FormatType = AcceptProposalOptions | ProposeProofOptions
