import type { ConnectionRecord } from '../connections'
import type { AutoAcceptProof } from './models/ProofAutoAcceptType'
import type { ProofProtocolVersion } from './models/ProofProtocolVersion'
import type { ProofRequest, ProofRequestOptions } from './protocol/v1/models'
import type {
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from './protocol/v1/models/PresentationPreview'
import type { ProofRecord } from './repository'

export interface V2ProposeProofFormat {
  indy?: ProofProposal
  w3c?: {
    // TODO
  }
}

export interface PresentationConfig {
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export type CreateProofRequestOptions = Partial<
  Pick<ProofRequestOptions, 'name' | 'nonce' | 'requestedAttributes' | 'requestedPredicates'>
>

export interface RequestProofOptions {
  connectionId: string
  protocolVersion: ProofProtocolVersion
  proofFormats: V2ProposeProofFormat
  proofRequestOptions: CreateProofRequestOptions
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface RequestProofFormats {
  indy?: {
    // new ProofRequest()
    proofRequest: IndyProofRequestOptions
  }
}

export interface CreateRequestOptions {
  connectionRecord: ConnectionRecord
  proofFormats: RequestProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreateRequestAsResponseOptions {
  proofRecord: ProofRecord
  proofFormats: RequestProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreatePresentationFormats {
  indy?: {
    // FIXME: interface instead of class
    requestedCredentials: RequestedCredentials
  }
}

export interface CreatePresentationOptions {
  proofRecord: ProofRecord
  proofFormats: CreatePresentationFormats
  // TODO: add other options such as comment, etc...
}
