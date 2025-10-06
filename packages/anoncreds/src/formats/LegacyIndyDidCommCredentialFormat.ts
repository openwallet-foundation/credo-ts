import type { DidCommCredentialFormat } from '@credo-ts/didcomm'
import type { AnonCredsCredential, AnonCredsCredentialOffer, AnonCredsCredentialRequest } from '../models'
import type {
  AnonCredsDidCommAcceptOfferFormat,
  AnonCredsDidCommAcceptProposalFormat,
  AnonCredsDidCommAcceptRequestFormat,
  AnonCredsDidCommCredentialProposalFormat,
  AnonCredsDidCommOfferCredentialFormat,
  AnonCredsDidCommProposeCredentialFormat,
} from './AnonCredsDidCommCredentialFormat'

// Legacy indy credential proposal doesn't support _id properties
export type LegacyIndyDidCommCredentialProposalFormat = Omit<
  AnonCredsDidCommCredentialProposalFormat,
  'schema_issuer_id' | 'issuer_id'
>

/**
 * This defines the module payload for calling CredentialsApi.createProposal
 * or CredentialsApi.negotiateOffer
 *
 * NOTE: This doesn't include the `issuerId` and `schemaIssuerId` properties that are present in the newer format.
 */
export type LegacyIndyDidCommProposeCredentialFormat = Omit<
  AnonCredsDidCommProposeCredentialFormat,
  'schemaIssuerId' | 'issuerId'
>

export interface LegacyIndyCredentialRequest extends AnonCredsCredentialRequest {
  // prover_did is optional in AnonCreds credential request, but required in legacy format
  prover_did: string
}

export interface LegacyIndyCredentialFormat extends DidCommCredentialFormat {
  formatKey: 'indy'

  credentialRecordType: 'w3c'

  // credential formats are the same as the AnonCreds credential format
  credentialFormats: {
    // The createProposal interface is different between the interfaces
    createProposal: LegacyIndyDidCommProposeCredentialFormat
    acceptProposal: AnonCredsDidCommAcceptProposalFormat
    createOffer: AnonCredsDidCommOfferCredentialFormat
    acceptOffer: AnonCredsDidCommAcceptOfferFormat
    createRequest: never // cannot start from createRequest
    acceptRequest: AnonCredsDidCommAcceptRequestFormat
  }

  // Format data is based on RFC 0592
  // https://github.com/hyperledger/aries-rfcs/tree/main/features/0592-indy-attachments
  formatData: {
    proposal: LegacyIndyDidCommCredentialProposalFormat
    offer: AnonCredsCredentialOffer
    request: LegacyIndyCredentialRequest
    credential: AnonCredsCredential
  }
}
