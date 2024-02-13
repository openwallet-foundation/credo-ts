import type { AnonCredsRevocationStatusList } from '../models'
import type { AgentContext } from '@credo-ts/core'

import { CredoError } from '@credo-ts/core'

import { AnonCredsRegistryService } from '../services'

export async function fetchSchema(agentContext: AgentContext, schemaId: string) {
  const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)

  const result = await registryService
    .getRegistryForIdentifier(agentContext, schemaId)
    .getSchema(agentContext, schemaId)

  if (!result || !result.schema) {
    throw new CredoError(`Schema not found for id ${schemaId}: ${result.resolutionMetadata.message}`)
  }

  const indyNamespace = result.schemaMetadata.didIndyNamespace

  return {
    schema: result.schema,
    schemaId: result.schemaId,
    indyNamespace: indyNamespace && typeof indyNamespace === 'string' ? indyNamespace : undefined,
  }
}

export async function fetchCredentialDefinition(agentContext: AgentContext, credentialDefinitionId: string) {
  const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)

  const result = await registryService
    .getRegistryForIdentifier(agentContext, credentialDefinitionId)
    .getCredentialDefinition(agentContext, credentialDefinitionId)

  if (!result || !result.credentialDefinition) {
    throw new CredoError(`Schema not found for id ${credentialDefinitionId}: ${result.resolutionMetadata.message}`)
  }

  const indyNamespace = result.credentialDefinitionMetadata.didIndyNamespace

  return {
    credentialDefinition: result.credentialDefinition,
    credentialDefinitionId,
    indyNamespace: indyNamespace && typeof indyNamespace === 'string' ? indyNamespace : undefined,
  }
}

export async function fetchRevocationRegistryDefinition(
  agentContext: AgentContext,
  revocationRegistryDefinitionId: string
) {
  const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)

  const result = await registryService
    .getRegistryForIdentifier(agentContext, revocationRegistryDefinitionId)
    .getRevocationRegistryDefinition(agentContext, revocationRegistryDefinitionId)

  if (!result || !result.revocationRegistryDefinition) {
    throw new CredoError(
      `RevocationRegistryDefinition not found for id ${revocationRegistryDefinitionId}: ${result.resolutionMetadata.message}`
    )
  }

  const indyNamespace = result.revocationRegistryDefinitionMetadata.didIndyNamespace

  return {
    revocationRegistryDefinition: result.revocationRegistryDefinition,
    revocationRegistryDefinitionId,
    indyNamespace: indyNamespace && typeof indyNamespace === 'string' ? indyNamespace : undefined,
  }
}

export async function fetchRevocationStatusList(
  agentContext: AgentContext,
  revocationRegistryId: string,
  timestamp: number
): Promise<{ revocationStatusList: AnonCredsRevocationStatusList }> {
  const registry = agentContext.dependencyManager
    .resolve(AnonCredsRegistryService)
    .getRegistryForIdentifier(agentContext, revocationRegistryId)

  const { revocationStatusList, resolutionMetadata } = await registry.getRevocationStatusList(
    agentContext,
    revocationRegistryId,
    timestamp
  )

  if (!revocationStatusList) {
    throw new CredoError(
      `Could not retrieve revocation status list for revocation registry ${revocationRegistryId}: ${resolutionMetadata.message}`
    )
  }

  return { revocationStatusList }
}
