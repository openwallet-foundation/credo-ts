import type {
  AnonCredsSchema,
  AnonCredsCredentialDefinition,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationList,
} from '../../../anoncreds/src/models/registry'
import type {
  AnonCredsRegistry,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  RegisterRevocationListOptions,
  RegisterRevocationListReturn,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'

export class IndySdkRegistry implements AnonCredsRegistry {
  public getSchema(agentContext: AgentContext, schemaId: string): Promise<AnonCredsSchema> {
    throw new Error('Method not implemented.')
  }
  public registerSchema(options: RegisterSchemaOptions): Promise<RegisterSchemaReturn> {
    throw new Error('Method not implemented.')
  }
  public getCredentialDefinition(credentialDefinitionId: string): Promise<AnonCredsCredentialDefinition> {
    throw new Error('Method not implemented.')
  }
  public registerCredentialDefinition(
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    throw new Error('Method not implemented.')
  }
  public getRevocationRegistryDefinition(
    revocationRegistryDefinitionId: string
  ): Promise<AnonCredsRevocationRegistryDefinition> {
    throw new Error('Method not implemented.')
  }
  public registerRevocationRegistryDefinition(
    options: RegisterRevocationRegistryDefinitionOptions
  ): Promise<RegisterRevocationRegistryDefinitionReturn> {
    throw new Error('Method not implemented.')
  }
  public getRevocationList(revocationRegistryId: string, timestamp: string): Promise<AnonCredsRevocationList> {
    throw new Error('Method not implemented.')
  }
  public registerRevocationList(options: RegisterRevocationListOptions): Promise<RegisterRevocationListReturn> {
    throw new Error('Method not implemented.')
  }
}
