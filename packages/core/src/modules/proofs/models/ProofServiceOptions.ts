import type { ConnectionRecord } from '../../connections'
import type { ProofFormat, ProofFormatPayload } from '../formats/ProofFormat'
import type { ProofRecord } from '../repository'
import type { GetRequestedCredentialsConfig } from './GetRequestedCredentialsConfig'
import type { AutoAcceptProof } from './ProofAutoAcceptType'

interface BaseOptions {
  willConfirm?: boolean
  goalCode?: string
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreateProposalOptions<PFs extends ProofFormat[]> extends BaseOptions {
  connectionRecord: ConnectionRecord
  proofFormats: ProofFormatPayload<PFs, 'createProposal'>
}

export interface CreateProposalAsResponseOptions<PFs extends ProofFormat[]> extends BaseOptions {
  proofRecord: ProofRecord
  proofFormats: ProofFormatPayload<PFs, 'createProposalAsResponse'>
}

export interface CreateRequestAsResponseOptions<PFs extends ProofFormat[]> extends BaseOptions {
  id?: string
  proofRecord: ProofRecord
  proofFormats: ProofFormatPayload<PFs, 'createRequestAsResponse'>
}

// ----- Out Of Band Proof ----- //
export interface CreateOutOfBandRequestOptions<PFs extends ProofFormat[]> extends BaseOptions {
  proofFormats: ProofFormatPayload<PFs, 'createOutOfBandRequest'>
}

export interface CreateRequestOptions<PFs extends ProofFormat[]> extends BaseOptions {
  connectionRecord?: ConnectionRecord
  proofFormats: ProofFormatPayload<PFs, 'createRequest'>
}

export interface CreateProofRequestFromProposalOptions extends BaseOptions {
  id?: string
  proofRecord: ProofRecord
}

export interface FormatRetrievedCredentialOptions<PFs extends ProofFormat[]> {
  proofFormats: ProofFormatPayload<PFs, 'retrieveCredentials'>
}

export interface FormatRequestedCredentialReturn<PFs extends ProofFormat[]> {
  proofFormats: ProofFormatPayload<PFs, 'requestCredentials'>
}

export interface CreatePresentationOptions<PFs extends ProofFormat[]> extends BaseOptions {
  proofRecord: ProofRecord
  proofFormats: ProofFormatPayload<PFs, 'createPresentation'> //
  lastPresentation?: boolean
}

export interface CreateAckOptions {
  proofRecord: ProofRecord
}

export interface GetRequestedCredentialsForProofRequestOptions {
  proofRecord: ProofRecord
  config?: GetRequestedCredentialsConfig
}

export interface ProofRequestFromProposalOptions<PFs extends ProofFormat[]> {
  proofRecord: ProofRecord
  proofFormats: ProofFormatPayload<PFs, 'createProofRequestFromProposal'>
}
