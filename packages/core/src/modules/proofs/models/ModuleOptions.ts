import type { GetRequestedCredentialsConfig } from './GetRequestedCredentialsConfig'
import type { AutoAcceptProof } from './ProofAutoAcceptType'
import type { CreatePresentationFormats, ProposeProofFormats } from './SharedOptions'

export interface ProofConfig {
  name: string
  version: string
}

export interface NegotiateRequestOptions {
  proofRecordId: string
  proofFormats: ProposeProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface AcceptPresentationOptions {
  proofRecordId: string
  comment?: string
  proofFormats: CreatePresentationFormats
}

export interface AutoSelectCredentialsForProofRequestOptions {
  proofRecordId: string
  config?: GetRequestedCredentialsConfig
}
