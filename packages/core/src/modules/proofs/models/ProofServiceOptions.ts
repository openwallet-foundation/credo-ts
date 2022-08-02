import type { ConnectionRecord } from '../../connections'
import type { ProofFormat, ProofFormatPayload } from '../formats/ProofFormat'
import type { ProofRequest } from '../formats/indy/models/ProofRequest'
import type { PresentationPreview } from '../protocol/v1/models/V1PresentationPreview'
import type { ProofRecord } from '../repository'
import type { GetRequestedCredentialsConfig } from './GetRequestedCredentialsConfig'
import type { AutoAcceptProof } from './ProofAutoAcceptType'
import type { ProofProtocolVersion } from './ProofProtocolVersion'
import type { CreatePresentationFormats, ProposeProofFormats, RequestProofFormats } from './SharedOptions'

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

// ----- Out Of Band Proof ----- //
export interface CreateOutOfBandRequestOptions<PFs extends ProofFormat[]> extends BaseOptions {
  proofFormats: ProofFormatPayload<PFs, 'createOutOfBandRequest'>
}

export interface CreateRequestOptions<PFs extends ProofFormat[]> extends BaseOptions {
  connectionRecord?: ConnectionRecord
  proofFormats: ProofFormatPayload<PFs, 'createRequest'>
}

export interface CreateRequestAsResponseOptions<PFs extends ProofFormat[]> extends BaseOptions {
  id?: string
  proofRecord: ProofRecord
  proofFormats: ProofFormatPayload<PFs, 'createRequestAsResponse'>
}

export interface CreatePresentationOptions<PFs extends ProofFormat[]> extends BaseOptions {
  proofRecord: ProofRecord
  proofFormats: ProofFormatPayload<PFs, 'createPresentation'>
  lastPresentation?: boolean
}

export interface CreateAckOptions {
  proofRecord: ProofRecord
}

// export interface RequestedCredentialForProofRequestOptions {
//   proofRequest: ProofRequest
//   presentationProposal?: PresentationPreview
// }
export interface GetRequestedCredentialsForProofRequestOptions {
  proofRecord: ProofRecord
  config?: GetRequestedCredentialsConfig
}

export interface ProofRequestFromProposalOptions {
  proofRecord: ProofRecord
}
