import type { AnonCredsResolutionMetadata, Extensible } from './base'
import type { AnonCredsRevocationRegistryDefinition } from '../../models/registry'

export interface GetRevocationRegistryDefinitionReturn {
  revocationRegistryDefinition?: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId: string
  resolutionMetadata: AnonCredsResolutionMetadata
  revocationRegistryDefinitionMetadata: Extensible
}

// TODO: Support for issuance of revocable credentials
// export interface RegisterRevocationRegistryDefinitionOptions {
//   revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
// }

// export interface RegisterRevocationRegistryDefinitionReturn {
//   revocationRegistryDefinitionId: string
// }
