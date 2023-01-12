import type {
  GetCredentialDefinitionReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
} from './CredentialDefinitionOptions'
import type { GetRevocationListReturn } from './RevocationListOptions'
import type { GetRevocationRegistryDefinitionReturn } from './RevocationRegistryDefinitionOptions'
import type { GetSchemaReturn, RegisterSchemaOptions, RegisterSchemaReturn } from './SchemaOptions'
import type { AgentContext } from '@aries-framework/core'

// This service can be registered multiple times in a single AFJ instance.
export interface AnonCredsRegistry {
  getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn>
  registerSchema(agentContext: AgentContext, options: RegisterSchemaOptions): Promise<RegisterSchemaReturn>

  getCredentialDefinition(
    agentContext: AgentContext,
    credentialDefinitionId: string
  ): Promise<GetCredentialDefinitionReturn>
  registerCredentialDefinition(
    agentContext: AgentContext,
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn>

  getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn>

  // TODO: issuance of revocable credentials
  // registerRevocationRegistryDefinition(
  //   agentContext: AgentContext,
  //   options: RegisterRevocationRegistryDefinitionOptions
  // ): Promise<RegisterRevocationRegistryDefinitionReturn>

  // TODO: The name of this data model is still tbd.
  getRevocationList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationListReturn>

  // TODO: issuance of revocable credentials
  // registerRevocationList(
  //   agentContext: AgentContext,
  //   options: RegisterRevocationListOptions
  // ): Promise<RegisterRevocationListReturn>
}
