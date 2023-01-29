// TODO: we may want to already support multiple credentials in the metadata of a credential
// record, as that's what the RFCs support. We already need to write a migration script for modules

/**
 * Metadata key for strong metadata on an AnonCreds credential.
 *
 * MUST be used with {@link AnonCredsCredentialMetadata}
 */
export const AnonCredsCredentialMetadataKey = '_anonCreds/anonCredsCredential'

/**
 * Metadata key for strong metadata on an AnonCreds credential request.
 *
 * MUST be used with {@link AnonCredsCredentialRequestMetadata}
 */
export const AnonCredsCredentialRequestMetadataKey = '_anonCreds/anonCredsCredentialRequest'

/**
 * Metadata for an AnonCreds credential that will be stored
 * in the credential record.
 *
 * MUST be used with {@link AnonCredsCredentialMetadataKey}
 */
export interface AnonCredsCredentialMetadata {
  schemaId?: string
  credentialDefinitionId?: string
  revocationRegistryId?: string
  credentialRevocationId?: string
}
