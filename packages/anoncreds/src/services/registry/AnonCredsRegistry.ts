import type {
  GetCredentialDefinitionReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
} from './CredentialDefinitionOptions'
import type { GetRevocationListReturn } from './RevocationListOptions'
import type { GetRevocationRegistryDefinitionReturn } from './RevocationRegistryDefinitionOptions'
import type { GetSchemaReturn, RegisterSchemaOptions, RegisterSchemaReturn } from './SchemaOptions'
import type { AgentContext } from '@aries-framework/core'

/**
 * @public
 */
export interface AnonCredsRegistry {
  // TODO: should this be a single regex? So just supportedMethodRegex. If you support multiple / has complex queries you can just combine them.
  // This would prevent the need for a double loop (loop through all registries, then loop through all supportedMethods)
  supportedMethods: RegExp[]

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
