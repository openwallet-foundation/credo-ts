export enum CredentialMetadataKeys {
  IndyCredential = '_internal/indyCredential',
  IndyRequest = '_internal/indyRequest',
}

export type CredentialMetadata = {
  [CredentialMetadataKeys.IndyCredential]: {
    schemaId?: string
    credentialDefinitionId?: string
  }
  [CredentialMetadataKeys.IndyRequest]: Record<string, unknown>
}
