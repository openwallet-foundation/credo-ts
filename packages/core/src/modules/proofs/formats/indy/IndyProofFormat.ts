import type { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import type { CredentialPreviewAttributeOptions } from '../../../credentials'
import type {
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../../protocol/v1/models/V1PresentationPreview'
import type { ProofFormat } from '../ProofFormat'
import type { IndyRequestProofFormat } from '../indy/IndyProofFormatsServiceOptions'
import type { RequestedAttribute } from './models/RequestedAttribute'
import type { IndyRequestedCredentialsOptions } from './models/RequestedCredentials'
import type { RequestedPredicate } from './models/RequestedPredicate'

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
  // Format data is based on RFC 0592
  // https://github.com/hyperledger/aries-rfcs/tree/main/features/0592-indy-attachments
  // formatData: {
  //   proposal: {
  //     schema_issuer_did?: string
  //     schema_name?: string
  //     schema_version?: string
  //     schema_id?: string
  //     issuer_did?: string
  //     cred_def_id?: string
  //   }
  //   offer: CredOffer
  //   request: CredReq
  //   credential: Cred
  // }
}
