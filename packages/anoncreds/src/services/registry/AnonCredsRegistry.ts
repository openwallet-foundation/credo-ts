import type { AgentContext } from '@credo-ts/core'
import type {
  GetCredentialDefinitionReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
} from './CredentialDefinitionOptions'
import type {
  GetRevocationRegistryDefinitionReturn,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationRegistryDefinitionReturn,
} from './RevocationRegistryDefinitionOptions'
import type {
  GetRevocationStatusListReturn,
  RegisterRevocationStatusListOptions,
  RegisterRevocationStatusListReturn,
} from './RevocationStatusListOptions'
import type { GetSchemaReturn, RegisterSchemaOptions, RegisterSchemaReturn } from './SchemaOptions'

/**
 * @public
 */
export interface AnonCredsRegistry {
  /**
   * A name to identify the registry. This will be stored as part of the registered anoncreds objects to allow querying
   * for created objects using a specific registry. Multiple implementations can use the same name, but they should in that
   * case also reference objects on the same networks.
   */
  methodName: string

  supportedIdentifier: RegExp

  /**
   * Whether this registry allows caching of resolved objects (as well as caching
   * just created objects).
   */
  readonly allowsCaching?: boolean

  /**
   * Whether the resolver allows using a local created object from
   * a record to resolve the object.
   *
   * @default false
   */
  readonly allowsLocalRecord?: boolean

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

  registerRevocationRegistryDefinition(
    agentContext: AgentContext,
    options: RegisterRevocationRegistryDefinitionOptions
  ): Promise<RegisterRevocationRegistryDefinitionReturn>

  getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn>

  registerRevocationStatusList(
    agentContext: AgentContext,
    options: RegisterRevocationStatusListOptions
  ): Promise<RegisterRevocationStatusListReturn>
}
