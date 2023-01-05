import type {
  AnonCredsCredentialDefinition,
  AnonCredsRevocationList,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsSchema,
} from '../models/registry'
import type {
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  RegisterRevocationListOptions,
  RegisterRevocationListReturn,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
} from './AnonCredsRegistryOptions'
import type { AgentContext } from '@aries-framework/core'

// This service can be registered multiple times in a single AFJ instance.
// TODO: should all methods have interfaces as input for consistency?
export interface AnonCredsRegistry {
  getSchema(agentContext: AgentContext, schemaId: string): Promise<AnonCredsSchema>
  registerSchema(options: RegisterSchemaOptions): Promise<RegisterSchemaReturn>

  getCredentialDefinition(credentialDefinitionId: string): Promise<AnonCredsCredentialDefinition>
  registerCredentialDefinition(
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn>

  getRevocationRegistryDefinition(
    revocationRegistryDefinitionId: string
  ): Promise<AnonCredsRevocationRegistryDefinition>
  registerRevocationRegistryDefinition(
    options: RegisterRevocationRegistryDefinitionOptions
  ): Promise<RegisterRevocationRegistryDefinitionReturn>

  // TODO: The name of this data model is still tbd.
  getRevocationList(revocationRegistryId: string, timestamp: string): Promise<AnonCredsRevocationList>

  registerRevocationList(options: RegisterRevocationListOptions): Promise<RegisterRevocationListReturn>
}
