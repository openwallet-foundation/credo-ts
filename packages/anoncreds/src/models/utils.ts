import type { W3cJsonLdVerifiableCredential } from '@credo-ts/core'
import type { AnonCredsNonRevokedInterval } from './exchange'
import type {
  AnonCredsCredentialDefinition,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsSchema,
} from './registry'

export interface AnonCredsSchemas {
  [schemaId: string]: AnonCredsSchema
}

export interface AnonCredsCredentialDefinitions {
  [credentialDefinitionId: string]: AnonCredsCredentialDefinition
}

export interface AnonCredsRevocationRegistries {
  [revocationRegistryDefinitionId: string]: {
    // tails file MUST already be downloaded on a higher level and stored
    tailsFilePath: string
    definition: AnonCredsRevocationRegistryDefinition
    revocationStatusLists: {
      [timestamp: number]: AnonCredsRevocationStatusList
    }
  }
}

export interface CredentialWithRevocationMetadata {
  credential: W3cJsonLdVerifiableCredential
  nonRevoked?: AnonCredsNonRevokedInterval
}
