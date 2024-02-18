import type { AnonCredsLinkSecretBlindingData } from '../models'

export interface AnonCredsCredentialMetadata {
  schemaId?: string
  credentialDefinitionId?: string
  revocationRegistryId?: string
  credentialRevocationId?: string
}

export interface AnonCredsCredentialRequestMetadata {
  link_secret_blinding_data: AnonCredsLinkSecretBlindingData
  link_secret_name: string
  nonce: string
}

export interface W3cAnoncredsCredentialMetadata {
  credentialId: string
  methodName: string
  credentialRevocationId?: string
  linkSecretId: string
}

// TODO: we may want to already support multiple credentials in the metadata of a credential
// record, as that's what the RFCs support. We already need to write a migration script for modules

/**
 * Metadata key for strong metadata on an AnonCreds credential.
 *
 * MUST be used with {@link AnonCredsCredentialMetadata}
 */
export const AnonCredsCredentialMetadataKey = '_anoncreds/credential'

/**
 * Metadata key for strong metadata on an AnonCreds credential request.
 *
 * MUST be used with {@link AnonCredsCredentialRequestMetadata}
 */
export const AnonCredsCredentialRequestMetadataKey = '_anoncreds/credentialRequest'

/**
 * Metadata key for storing the W3C AnonCreds credential metadata.
 *
 * MUST be used with {@link W3cAnoncredsCredentialMetadata}
 */
export const W3cAnonCredsCredentialMetadataKey = '_w3c/anonCredsMetadata'
