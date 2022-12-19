import type {
  AnonCredsCredentialDefinition,
  AnonCredsRevocationList,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsSchema,
} from '../models/vdr'
import type { AgentContext } from '@aries-framework/core'

export interface RegisterSchemaOptions {
  agentContext: AgentContext
  schema: AnonCredsSchema

  // Identifier of issuer that will create the credential definition.
  issuerId: string
}
export interface RegisterSchemaReturn {
  schemaId: string
}

export interface RegisterCredentialDefinitionOptions {
  credentialDefinition: AnonCredsCredentialDefinition

  // Identifier of issuer that will create the credential definition.
  issuerId: string
}

export interface RegisterCredentialDefinitionReturn {
  credentialDefinitionId: string
}

export interface RegisterRevocationRegistryDefinitionOptions {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
}

export interface RegisterRevocationRegistryDefinitionReturn {
  revocationRegistryDefinitionId: string
}

export interface RegisterRevocationListOptions {
  // Timestamp is often calculated by the ledger, otherwise method should just take current time
  // Return type does include the timestamp.
  revocationList: Omit<AnonCredsRevocationList, 'timestamp'>
}

export interface RegisterRevocationListReturn {
  timestamp: string
}
