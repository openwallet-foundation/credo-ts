import type {
  DidCommCredentialFormat,
  DidCommCredentialPreviewAttributeOptions,
  DidCommLinkedAttachment,
} from '@credo-ts/didcomm'
import type { AnonCredsCredential, AnonCredsCredentialOffer, AnonCredsCredentialRequest } from '../models'

export interface AnonCredsDidCommCredentialProposalFormat {
  schema_issuer_id?: string
  schema_name?: string
  schema_version?: string
  schema_id?: string

  cred_def_id?: string
  issuer_id?: string

  // TODO: we don't necessarily need to include these in the AnonCreds Format RFC
  // as it's a new one and we can just forbid the use of legacy properties
  schema_issuer_did?: string
  issuer_did?: string
}

/**
 * This defines the module payload for calling CredentialsApi.createProposal
 * or CredentialsApi.negotiateOffer
 */
export interface AnonCredsDidCommProposeCredentialFormat {
  schemaIssuerId?: string
  schemaId?: string
  schemaName?: string
  schemaVersion?: string

  credentialDefinitionId?: string
  issuerId?: string

  attributes?: DidCommCredentialPreviewAttributeOptions[]
  linkedAttachments?: DidCommLinkedAttachment[]

  // Kept for backwards compatibility
  schemaIssuerDid?: string
  issuerDid?: string
}

/**
 * This defines the module payload for calling CredentialsApi.acceptProposal
 */
export interface AnonCredsDidCommAcceptProposalFormat {
  credentialDefinitionId?: string
  revocationRegistryDefinitionId?: string
  revocationRegistryIndex?: number
  attributes?: DidCommCredentialPreviewAttributeOptions[]
  linkedAttachments?: DidCommLinkedAttachment[]
}

/**
 * This defines the module payload for calling CredentialsApi.acceptOffer. No options are available for this
 * method, so it's an empty object
 */
export interface AnonCredsDidCommAcceptOfferFormat {
  linkSecretId?: string
}

/**
 * This defines the module payload for calling CredentialsApi.offerCredential
 * or CredentialsApi.negotiateProposal
 */
export interface AnonCredsDidCommOfferCredentialFormat {
  credentialDefinitionId: string
  revocationRegistryDefinitionId?: string
  revocationRegistryIndex?: number
  attributes: DidCommCredentialPreviewAttributeOptions[]
  linkedAttachments?: DidCommLinkedAttachment[]
}

/**
 * This defines the module payload for calling CredentialsApi.acceptRequest. No options are available for this
 * method, so it's an empty object
 */
export type AnonCredsDidCommAcceptRequestFormat = Record<string, never>

export interface AnonCredsDidCommCredentialFormat extends DidCommCredentialFormat {
  formatKey: 'anoncreds'
  credentialRecordType: 'w3c'
  credentialFormats: {
    createProposal: AnonCredsDidCommProposeCredentialFormat
    acceptProposal: AnonCredsDidCommAcceptProposalFormat
    createOffer: AnonCredsDidCommOfferCredentialFormat
    acceptOffer: AnonCredsDidCommAcceptOfferFormat
    createRequest: never // cannot start from createRequest
    acceptRequest: AnonCredsDidCommAcceptRequestFormat
  }
  // TODO: update to new RFC once available
  // Format data is based on RFC 0592
  // https://github.com/hyperledger/aries-rfcs/tree/main/features/0592-indy-attachments
  formatData: {
    proposal: AnonCredsDidCommCredentialProposalFormat
    offer: AnonCredsCredentialOffer
    request: AnonCredsCredentialRequest
    credential: AnonCredsCredential
  }
}
