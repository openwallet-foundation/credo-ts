import type { AutoAcceptProof, ProofRecord } from '..'
import type { ConnectionRecord } from '../../connections'
import type { ProofProtocolVersion } from './ProofProtocolVersion'
import type { ProposeProofFormats } from './SharedOptions'

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
  connectionId: string
  protocolVersion: ProofProtocolVersion
  proofFormats: V2ProposeProofFormat
  proofRequestOptions: CreateProofRequestOptions
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
export interface CreatePresentationOptions {
  proofRecord: ProofRecord
  proofFormats: CreatePresentationFormats
  // TODO: add other options such as comment, etc...
}
