import type { ProofFormat, ProofFormatPayload } from './formats'
import type { AutoAcceptProof, GetRequestedCredentialsConfig } from './models'
import type { ProofExchangeRecord } from './repository'
import type { ConnectionRecord } from '../connections'

export type FormatDataMessagePayload<
  CFs extends ProofFormat[] = ProofFormat[],
  M extends keyof ProofFormat['formatData'] = keyof ProofFormat['formatData']
> = {
  [ProofFormat in CFs[number] as ProofFormat['formatKey']]?: ProofFormat['formatData'][M]
}

export interface BaseOptions {
  willConfirm?: boolean
  goalCode?: string
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreateProposalOptions<PFs extends ProofFormat[]> extends BaseOptions {
  connectionRecord: ConnectionRecord
  proofFormats: ProofFormatPayload<PFs, 'createProposal'>
  parentThreadId?: string
}

export interface CreateRequestAsResponseOptions<PFs extends ProofFormat[]> extends BaseOptions {
  id?: string
  proofRecord: ProofExchangeRecord
  proofFormats: ProofFormatPayload<PFs, 'createRequestAsResponse'>
}

export interface CreateProposalAsResponseOptions<PFs extends ProofFormat[]> extends BaseOptions {
  proofRecord: ProofExchangeRecord
  proofFormats: ProofFormatPayload<PFs, 'createProposalAsResponse'>
}

export interface CreateRequestOptions<PFs extends ProofFormat[]> extends BaseOptions {
  connectionRecord?: ConnectionRecord
  proofFormats: ProofFormatPayload<PFs, 'createRequest'>
  parentThreadId?: string
}

export interface CreateProofRequestFromProposalOptions extends BaseOptions {
  id?: string
  proofRecord: ProofExchangeRecord
}

export interface RetrievedCredentialOptions<PFs extends ProofFormat[]> {
  proofFormats: ProofFormatPayload<PFs, 'retrieveCredentials'>
}

export interface RequestedCredentialReturn<PFs extends ProofFormat[]> {
  proofFormats: ProofFormatPayload<PFs, 'requestCredentials'>
}

export interface CreatePresentationOptions<PFs extends ProofFormat[]> extends BaseOptions {
  proofRecord: ProofExchangeRecord
  proofFormats: ProofFormatPayload<PFs, 'createPresentation'> //
  lastPresentation?: boolean
}

export interface CreateAckOptions {
  proofRecord: ProofExchangeRecord
}

export interface GetRequestedCredentialsForProofRequestOptions {
  proofRecord: ProofExchangeRecord
  config?: GetRequestedCredentialsConfig
}

export interface ProofRequestFromProposalOptions<PFs extends ProofFormat[]> {
  proofRecord: ProofExchangeRecord
  proofFormats: ProofFormatPayload<PFs, 'createProofRequestFromProposal'>
}

export interface DeleteProofOptions {
  deleteAssociatedDidCommMessages?: boolean
}

export type GetFormatDataReturn<PFs extends ProofFormat[] = ProofFormat[]> = {
  proposal?: FormatDataMessagePayload<PFs, 'proposal'>
  request?: FormatDataMessagePayload<PFs, 'request'>
  presentation?: FormatDataMessagePayload<PFs, 'presentation'>
}

export interface CreateProblemReportOptions {
  proofRecord: ProofExchangeRecord
  description: string
}
