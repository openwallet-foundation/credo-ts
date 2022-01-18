import type { AutoAcceptProof } from '..'
import type { ProposeProofFormats } from '../interface'
import type { ProofProtocolVersion } from './ProofProtocolVersion'

export interface ProposeProofOptions {
  connectionId: string
  protocolVersion: ProofProtocolVersion
  proofFormats: ProposeProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface NegotiateRequestOptions {
  proofRecordId: string
  proofFormats: ProposeProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface AcceptProposalOptions {
  proofRecordId: string
  proofFormats: ProposeProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}
