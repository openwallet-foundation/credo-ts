/**
 * Metadata key for storing metadata.
 *
 * MUST be used with {@link DataIntegrityMetadata}
 */
export const DataIntegrityMetadataKey = '_dataIntegrity/credential'

export interface DataIntegrityLinkSecretMetadata {
  schemaId: string
  credentialDefinitionId: string
  revocationRegistryId?: string
  credentialRevocationId?: string
}

/**
 * Metadata for an data integrity credential offers / requests that will be stored
 * in the credential record.
 *
 * MUST be used with {@link DataIntegrityMetadataKey}
 */
export interface DataIntegrityMetadata {
  linkSecretMetadata?: DataIntegrityLinkSecretMetadata
}

/**
 * Metadata key for storing metadata on an anonCreds link secret credential request.
 *
 * MUST be used with {@link AnonCredsCredentialRequestMetadata}
 */
export const DataIntegrityRequestMetadataKey = '_dataIntegrity/credentialRequest'

export interface DataIntegrityLinkSecretRequestMetadata {
  link_secret_blinding_data: AnonCredsLinkSecretBlindingData
  link_secret_name: string
  nonce: string
}

export interface DataIntegrityRequestMetadata {
  linkSecretRequestMetadata?: DataIntegrityLinkSecretRequestMetadata
}

export interface AnonCredsLinkSecretBlindingData {
  v_prime: string
  vr_prime: string | null
}
