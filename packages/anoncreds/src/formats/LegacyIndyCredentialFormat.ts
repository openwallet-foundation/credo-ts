import type {
  AnonCredsAcceptOfferFormat,
  AnonCredsAcceptProposalFormat,
  AnonCredsAcceptRequestFormat,
  AnonCredsOfferCredentialFormat,
} from './AnonCredsCredentialFormat'
import type { AnonCredsCredential, AnonCredsCredentialOffer, AnonCredsCredentialRequest } from '../models'
import type { CredentialPreviewAttributeOptions, CredentialFormat, LinkedAttachment } from '@aries-framework/core'

/**
 * This defines the module payload for calling CredentialsApi.createProposal
 * or CredentialsApi.negotiateOffer
 *
 * NOTE: This doesn't include the `issuerId` and `schemaIssuerId` properties that are present in the newer format.
 */
export interface LegacyIndyProposeCredentialFormat {
  schemaIssuerDid?: string
  schemaId?: string
  schemaName?: string
  schemaVersion?: string

  credentialDefinitionId?: string
  issuerDid?: string

  attributes?: CredentialPreviewAttributeOptions[]
  linkedAttachments?: LinkedAttachment[]
}

export interface LegacyIndyCredentialRequest extends AnonCredsCredentialRequest {
  // prover_did is optional in AnonCreds credential request, but required in legacy format
  prover_did: string
}

export interface LegacyIndyCredentialFormat extends CredentialFormat {
  formatKey: 'indy'

  // The stored type is the same as the anoncreds credential service
  credentialRecordType: 'anoncreds'

  // credential formats are the same as the AnonCreds credential format
  credentialFormats: {
    // The createProposal interface is different between the interfaces
    createProposal: LegacyIndyProposeCredentialFormat
    acceptProposal: AnonCredsAcceptProposalFormat
    createOffer: AnonCredsOfferCredentialFormat
    acceptOffer: AnonCredsAcceptOfferFormat
    createRequest: never // cannot start from createRequest
    acceptRequest: AnonCredsAcceptRequestFormat
  }

  // Format data is based on RFC 0592
  // https://github.com/hyperledger/aries-rfcs/tree/main/features/0592-indy-attachments
  formatData: {
    proposal: {
      schema_name?: string
      schema_issuer_did?: string
      schema_version?: string
      schema_id?: string

      cred_def_id?: string
      issuer_did?: string
    }
    offer: AnonCredsCredentialOffer
    request: LegacyIndyCredentialRequest
    credential: AnonCredsCredential
  }
}
