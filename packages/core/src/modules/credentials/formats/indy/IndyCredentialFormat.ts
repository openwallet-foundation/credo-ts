import type { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import type { CredentialPreviewAttributeOptions, CredentialPreviewAttribute } from '../../models'
import type { CredentialFormat } from '../CredentialFormat'
import type { IndyCredProposeOptions } from './models/IndyCredPropose'

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
}
