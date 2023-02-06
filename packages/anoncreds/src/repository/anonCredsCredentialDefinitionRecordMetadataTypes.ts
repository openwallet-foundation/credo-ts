import type { Extensible } from '../services/registry/base'

export enum AnonCredsCredentialDefinitionRecordMetadataKeys {
  CredentialDefinitionRegistrationMetadata = '_internal/anonCredsCredentialDefinitionRegistrationMetadata',
  CredentialDefinitionMetadata = '_internal/anonCredsCredentialDefinitionMetadata',
}

export type AnonCredsCredentialDefinitionRecordMetadata = {
  [AnonCredsCredentialDefinitionRecordMetadataKeys.CredentialDefinitionRegistrationMetadata]: Extensible
  [AnonCredsCredentialDefinitionRecordMetadataKeys.CredentialDefinitionMetadata]: Extensible
}
