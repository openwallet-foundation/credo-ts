import type {
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../PresentationPreview'
import type { AutoAcceptProof } from '../ProofAutoAcceptType'
import type { ProofProtocolVersion } from '../ProofProtocolVersion'

export interface ProposeProofOptions {
  connectionId: string
  protocolVersion: ProofProtocolVersion
  proofFormats: V2ProposeProofFormat
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface ProposeProofFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyProposeProofFormat
  w3c?: W3CProofFormat
}

interface IndyProposeProofFormat {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
  nonce: string
  name: string
  version: string
  proofPreview?: PresentationPreview
}

export interface W3CProofFormat {
  inputDescriptors: string
}

export interface V2ProposeProofFormat {
  indy?: ProofProposal
  w3c?: {
    // TODO
  }
}

interface ProofProposal {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
}
