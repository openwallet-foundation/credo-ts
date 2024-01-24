import type {
  AnonCredsLinkSecretCredentialRequestOptions,
  DataIntegrityCredential,
  DataIntegrityCredentialOffer,
  DataIntegrityCredentialRequest,
  DidCommSignedAttachmentCredentialRequestOptions,
  W3C_VC_DATA_MODEL_VERSION,
} from './dataIntegrityExchange'
import type { CredentialFormat, JsonObject } from '../../../..'
import type { W3cCredential } from '../../../vc'

export interface AnonCredsLinkSecretBindingMethodOptions {
  credentialDefinitionId: string
  revocationRegistryDefinitionId?: string
  revocationRegistryIndex?: number
}

export interface DidCommSignedAttachmentBindingMethodOptions {
  didMethodsSupported?: string[]
  algsSupported?: string[]
}

/**
 * This defines the module payload for calling CredentialsApi.acceptOffer. No options are available for this
 * method, so it's an empty object
 */
export interface DataIntegrityAcceptOfferFormat {
  dataModelVersion?: W3C_VC_DATA_MODEL_VERSION
  didCommSignedAttachmentCredentialRequestOptions?: DidCommSignedAttachmentCredentialRequestOptions
  anonCredsLinkSecretCredentialRequestOptions?: AnonCredsLinkSecretCredentialRequestOptions
}

/**
 * This defines the module payload for calling CredentialsApi.offerCredential
 * or CredentialsApi.negotiateProposal
 */
export interface DataIntegrityOfferCredentialFormat {
  credential: W3cCredential | JsonObject
  bindingRequired: boolean
  anonCredsLinkSecretBindingMethodOptions?: AnonCredsLinkSecretBindingMethodOptions
  didCommSignedAttachmentBindingMethodOptions?: DidCommSignedAttachmentBindingMethodOptions
}

/**
 * This defines the module payload for calling CredentialsApi.acceptRequest. No options are available for this
 * method, so it's an empty object
 */
export type DataIntegrityAcceptRequestFormat = {
  credentialSubjectId?: string
  didCommSignedAttachmentAcceptRequestOptions?: {
    kid: string
  }
}

export interface DataIntegrityCredentialFormat extends CredentialFormat {
  formatKey: 'dataIntegrity'
  credentialRecordType: 'w3c'
  credentialFormats: {
    createProposal: never
    acceptProposal: never
    createOffer: DataIntegrityOfferCredentialFormat
    acceptOffer: DataIntegrityAcceptOfferFormat
    createRequest: never // cannot start from createRequest
    acceptRequest: DataIntegrityAcceptRequestFormat
  }
  formatData: {
    proposal: never
    offer: DataIntegrityCredentialOffer
    request: DataIntegrityCredentialRequest
    credential: DataIntegrityCredential
  }
}
