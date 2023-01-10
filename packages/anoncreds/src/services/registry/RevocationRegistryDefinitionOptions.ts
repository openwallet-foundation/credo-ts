import type { AnonCredsRevocationRegistryDefinition } from '../../models/registry'
import type { AnonCredsResolutionMetadata, Extensible } from './base'

export interface GetRevocationRegistryDefinitionReturn {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition | null
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
