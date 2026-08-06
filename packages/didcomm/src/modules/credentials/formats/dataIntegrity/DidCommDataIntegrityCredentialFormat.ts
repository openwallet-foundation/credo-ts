import type { JsonObject, W3cCredential } from '@credo-ts/core'
import type { DidCommCredentialFormat } from '../DidCommCredentialFormat'
import type {
  AnonCredsLinkSecretCredentialRequestOptions as AnonCredsLinkSecretAcceptOfferOptions,
  DataIntegrityCredential,
  DataIntegrityCredentialOffer,
  DataIntegrityCredentialRequest,
  DidCommSignedAttachmentCredentialRequestOptions as DidCommSignedAttachmentAcceptOfferOptions,
  W3C_VC_DATA_MODEL_VERSION,
} from './dataIntegrityExchange'

export interface DidCommAnonCredsLinkSecretCreateOfferOptions {
  credentialDefinitionId: string
  revocationRegistryDefinitionId?: string
  revocationRegistryIndex?: number
}

export interface DidCommSignedAttachmentCreateOfferOptions {
  didMethodsSupported?: string[]
  algsSupported?: string[]
}

export interface DidCommDataIntegrityAcceptOfferFormat {
  dataModelVersion?: W3C_VC_DATA_MODEL_VERSION
  didCommSignedAttachment?: DidCommSignedAttachmentAcceptOfferOptions
  anonCredsLinkSecret?: AnonCredsLinkSecretAcceptOfferOptions
}

/**
 * This defines the module payload for calling CredentialsApi.offerCredential
 */
export interface DidCommDataIntegrityOfferCredentialFormat {
  credential: W3cCredential | JsonObject
  bindingRequired: boolean
  anonCredsLinkSecretBinding?: DidCommAnonCredsLinkSecretCreateOfferOptions
  didCommSignedAttachmentBinding?: DidCommSignedAttachmentCreateOfferOptions
}

/**
 * This defines the module payload for calling CredentialsApi.acceptRequest
 */
export interface DidCommDataIntegrityAcceptRequestFormat {
  credentialSubjectId?: string
  issuerVerificationMethod?: string

  /**
   * The Data Integrity cryptosuite to secure a data model 2.0 credential with, for example
   * `eddsa-jcs-2022`.
   *
   * RFC 0809 leaves the choice of cryptosuite to the issuer, so this is not negotiated with the
   * holder. When omitted a cryptosuite supported by the issuer verification method key type is
   * selected. Ignored for data model 1.1 credentials, which are secured with a linked data
   * signature suite instead.
   */
  cryptosuite?: string
}

export interface DidCommDataIntegrityCredentialFormat extends DidCommCredentialFormat {
  formatKey: 'dataIntegrity'
  credentialRecordType: 'w3c' | 'w3c-v2'
  credentialFormats: {
    createProposal: never
    acceptProposal: never
    createOffer: DidCommDataIntegrityOfferCredentialFormat
    acceptOffer: DidCommDataIntegrityAcceptOfferFormat
    createRequest: never // cannot start from createRequest
    acceptRequest: DidCommDataIntegrityAcceptRequestFormat
  }
  formatData: {
    proposal: never
    offer: DataIntegrityCredentialOffer
    request: DataIntegrityCredentialRequest
    credential: DataIntegrityCredential
  }
}
