import type { Extensible } from '../services/registry/base'

export enum AnonCredsRevocationRegistryDefinitionRecordMetadataKeys {
  RevocationRegistryDefinitionRegistrationMetadata = '_internal/anonCredsRevocationRegistryDefinitionRegistrationMetadata',
  RevocationRegistryDefinitionMetadata = '_internal/anonCredsRevocationRegistryDefinitionMetadata',
}

export type AnonCredsRevocationRegistryDefinitionRecordMetadata = {
  [AnonCredsRevocationRegistryDefinitionRecordMetadataKeys.RevocationRegistryDefinitionRegistrationMetadata]: Extensible
  [AnonCredsRevocationRegistryDefinitionRecordMetadataKeys.RevocationRegistryDefinitionMetadata]: Extensible
}
