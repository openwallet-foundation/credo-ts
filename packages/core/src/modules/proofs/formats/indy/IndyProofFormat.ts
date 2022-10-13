import type { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import type { CredentialPreviewAttributeOptions } from '../../../credentials'
import type { IndyProofProposal, IndyProofRequest } from '../../protocol/v1/messages/V1RequestPresentationMessage'
import type {
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../../protocol/v1/models/V1PresentationPreview'
import type { ProofFormat } from '../ProofFormat'
import type { IndyRequestProofFormat } from '../indy/IndyProofFormatsServiceOptions'
import type { RequestedAttribute } from './models/RequestedAttribute'
import type { IndyRequestedCredentialsOptions } from './models/RequestedCredentials'
import type { RequestedPredicate } from './models/RequestedPredicate'
import type { IndyProof } from 'indy-sdk'

export interface IndyProposeProofFormat {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
  nonce: string
  name: string
  version: string
}

/**
 * This defines the module payload for calling CredentialsApi.acceptProposal
 */
export interface IndyAcceptProposalFormat {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttributeOptions[]
  linkedAttachments?: LinkedAttachment[]
}

export interface IndyAcceptOfferFormat {
  holderDid?: string
}

export interface IndyRequestedCredentialsFormat {
  requestedAttributes: Record<string, RequestedAttribute>
  requestedPredicates: Record<string, RequestedPredicate>
  selfAttestedAttributes: Record<string, string>
}

export interface IndyRetrievedCredentialsFormat {
  requestedAttributes: Record<string, RequestedAttribute[]>
  requestedPredicates: Record<string, RequestedPredicate[]>
}

export interface IndyProofFormat extends ProofFormat {
  formatKey: 'indy'
  proofRecordType: 'indy'
  proofFormats: {
    createProposal: IndyProposeProofFormat
    acceptProposal: unknown
    createRequest: IndyRequestProofFormat
    acceptRequest: unknown
    createPresentation: IndyRequestedCredentialsOptions
    acceptPresentation: unknown
    createProposalAsResponse: IndyProposeProofFormat
    createOutOfBandRequest: unknown
    createRequestAsResponse: IndyRequestProofFormat
    createProofRequestFromProposal: IndyRequestProofFormat
    requestCredentials: IndyRequestedCredentialsFormat
    retrieveCredentials: IndyRetrievedCredentialsFormat
  }

  formatData: {
    proposal: IndyProofProposal
    request: IndyProofRequest
    presentation: IndyProof
  }
}
