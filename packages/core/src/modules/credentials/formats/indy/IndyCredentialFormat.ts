import type { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import type { CredentialPreviewAttributeOptions } from '../../models'
import type { CredentialFormat } from '../CredentialFormat'
import type { IndyCredProposeOptions } from './models/IndyCredPropose'
import type { Cred, CredOffer, CredReq } from 'indy-sdk'

/**
 * This defines the module payload for calling CredentialsModule.createProposal
 * or CredentialsModule.negotiateOffer
 */
export interface IndyProposeCredentialFormat extends IndyCredProposeOptions {
  attributes?: CredentialPreviewAttributeOptions[]
  linkedAttachments?: LinkedAttachment[]
}

/**
 * This defines the module payload for calling CredentialsModule.acceptProposal
 */
export interface IndyAcceptProposalFormat {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttributeOptions[]
  linkedAttachments?: LinkedAttachment[]
}

export interface IndyAcceptOfferFormat {
  holderDid?: string
}

/**
 * This defines the module payload for calling CredentialsModule.offerCredential
 * or CredentialsModule.negotiateProposal
 */
export interface IndyOfferCredentialFormat {
  credentialDefinitionId: string
  attributes: CredentialPreviewAttributeOptions[]
  linkedAttachments?: LinkedAttachment[]
}

export interface IndyIssueCredentialFormat {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttributeOptions[]
}

export interface IndyCredentialFormat extends CredentialFormat {
  formatKey: 'indy'
  credentialRecordType: 'indy'
  credentialFormats: {
    createProposal: IndyProposeCredentialFormat
    acceptProposal: IndyAcceptProposalFormat
    createOffer: IndyOfferCredentialFormat
    acceptOffer: IndyAcceptOfferFormat
    createRequest: never // cannot start from createRequest
    acceptRequest: Record<string, never> // empty object
  }
  // Format data is based on RFC 0592
  // https://github.com/hyperledger/aries-rfcs/tree/main/features/0592-indy-attachments
  formatData: {
    proposal: {
      schema_issuer_did?: string
      schema_name?: string
      schema_version?: string
      schema_id?: string
      issuer_did?: string
      cred_def_id?: string
    }
    offer: CredOffer
    request: CredReq
    credential: Cred
  }
}
