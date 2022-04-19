import type { ProofRequestOptions } from '../formats/indy/models/ProofRequest'
import type { GetRequestedCredentialsConfig } from './GetRequestedCredentialsConfig'
import type { AutoAcceptProof } from './ProofAutoAcceptType'
import type { ProofProtocolVersion } from './ProofProtocolVersion'
import type { CreatePresentationFormats, ProposeProofFormats, RequestProofFormats } from './SharedOptions'

export interface ProofConfig {
  name: string
  version: string
}

export interface ProposeProofOptions {
  connectionId: string
  protocolVersion: ProofProtocolVersion
  proofFormats: ProposeProofFormats
  comment?: string
  goalCode?: string
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
  config?: ProofConfig
  goalCode?: string
  willConfirm?: boolean
  comment?: string
}

export interface RequestProofOptions {
  protocolVersion: ProofProtocolVersion
  connectionId: string
  proofFormats: RequestProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface OutOfBandRequestOptions {
  protocolVersion: ProofProtocolVersion
  proofFormats: RequestProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export type CreateProofRequestOptions = Partial<
  Pick<ProofRequestOptions, 'name' | 'nonce' | 'requestedAttributes' | 'requestedPredicates'>
>

export interface AcceptPresentationOptions {
  proofRecordId: string
  comment?: string
  proofFormats: CreatePresentationFormats
}

export interface AutoSelectCredentialsForProofRequestOptions {
  proofRecordId: string
  config?: GetRequestedCredentialsConfig
}
