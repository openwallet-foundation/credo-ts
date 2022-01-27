import type { AutoAcceptProof, ProofRecord } from '..'
import type { ConnectionRecord } from '../../connections'
import type { ProofProtocolVersion } from './ProofProtocolVersion'
import type { CreatePresentationFormats, ProposeProofFormats, RequestProofFormats } from './SharedOptions'

// ----- Create Proposal ----- //
export interface CreateProposalOptions {
  connectionRecord: ConnectionRecord
  protocolVersion: ProofProtocolVersion
  proofFormats: ProposeProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreateProposalAsResponseOptions {
  proofRecord: ProofRecord
  proofFormats: ProposeProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

// ----- Request Proof ----- //
export interface RequestProofOptions {
  connectionRecord: ConnectionRecord
  protocolVersion: ProofProtocolVersion
  proofFormats: RequestProofFormats
  // proofRequestOptions: CreateProofRequestOptions
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreateRequestAsResponseOptions {
  proofRecord: ProofRecord
  proofFormats: RequestProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

// ----- Create Presentation ----- //
export interface PresentationOptions {
  proofRecord: ProofRecord
  proofFormats: CreatePresentationFormats
  comment?: string
  // TODO: add other options such as comment, etc...
}

export interface CreateAckOptions {
  proofRecord: ProofRecord
}
