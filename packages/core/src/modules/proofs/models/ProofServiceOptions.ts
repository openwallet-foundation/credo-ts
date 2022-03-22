import type { AutoAcceptProof, ProofRecord, ProofRequest } from '..'
import type { ConnectionRecord } from '../../connections'
import type { PresentationPreview } from './PresentationPreview'
import type { ProofProtocolVersion } from './ProofProtocolVersion'
import type { CreatePresentationFormats, ProposeProofFormats, RequestProofFormats } from './SharedOptions'

// ----- Create Proposal ----- //
export interface CreateProposalOptions {
  connectionRecord: ConnectionRecord
  protocolVersion: ProofProtocolVersion
  proofFormats: ProposeProofFormats
  willConfirm?: boolean
  goalCode?: string
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreateProposalAsResponseOptions {
  proofRecord: ProofRecord
  proofFormats: ProposeProofFormats
  willConfirm?: boolean
  goalCode?: string
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

// ----- Out Of Band Proof ----- //
export interface CreateOutOfBandRequestOptions {
  protocolVersion: ProofProtocolVersion
  proofFormats: ProposeProofFormats
  willConfirm?: boolean
  goalCode?: string
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

// ----- Request Proof ----- //
export interface CreateRequestOptions {
  connectionRecord?: ConnectionRecord
  protocolVersion: ProofProtocolVersion
  proofFormats: ProposeProofFormats
  willConfirm?: boolean
  goalCode?: string
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreateRequestAsResponseOptions {
  proofRecord: ProofRecord
  protocolVersion: ProofProtocolVersion
  proofFormats: RequestProofFormats
  willConfirm?: boolean
  goalCode?: string
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

// ----- Create Presentation ----- //
export interface CreatePresentationOptions {
  proofRecord: ProofRecord
  proofFormats: CreatePresentationFormats
  lastPresentation?: boolean
  goalCode?: string
  comment?: string
  protocolVersion: ProofProtocolVersion
}

export interface CreateAckOptions {
  proofRecord: ProofRecord
}

export interface RequestedCredentialForProofRequestOptions {
  proofRequest: ProofRequest
  presentationProposal?: PresentationPreview
}
