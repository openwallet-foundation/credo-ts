import type {
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../PresentationPreview'
import type { AutoAcceptProof } from '../ProofAutoAcceptType'
import type { ProofProtocolVersion } from '../ProofProtocolVersion'
import type { ProofRecord } from '../repository'
import type { ProofRequest } from '../v1/models'

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
