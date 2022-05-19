import type { ConnectionRecord } from '../../connections'
import type { ProofRequest } from '../formats/indy/models/ProofRequest'
import type { PresentationPreview } from '../protocol/v1/models/V1PresentationPreview'
import type { ProofRecord } from '../repository'
import type { GetRequestedCredentialsConfig } from './GetRequestedCredentialsConfig'
import type { AutoAcceptProof } from './ProofAutoAcceptType'
import type { ProofProtocolVersion } from './ProofProtocolVersion'
import type { CreatePresentationFormats, ProposeProofFormats, RequestProofFormats } from './SharedOptions'

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
  proofFormats: RequestProofFormats
  willConfirm?: boolean
  goalCode?: string
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreatePresentationOptions {
  proofRecord: ProofRecord
  proofFormats: CreatePresentationFormats
  lastPresentation?: boolean
  goalCode?: string
  comment?: string
  protocolVersion: ProofProtocolVersion
  willConfirm?: boolean
}

export interface CreateAckOptions {
  proofRecord: ProofRecord
}

export interface RequestedCredentialForProofRequestOptions {
  proofRequest: ProofRequest
  presentationProposal?: PresentationPreview
}
export interface GetRequestedCredentialsForProofRequestOptions {
  proofRecord: ProofRecord
  config?: GetRequestedCredentialsConfig
}

export interface ProofRequestFromProposalOptions {
  name: string
  version: string
  nonce: string
  proofRecord: ProofRecord
}
