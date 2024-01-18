import type { GetCredentialDefinitionReturn, GetSchemaReturn, GetRevocationRegistryDefinitionReturn } from '../services'
import type { AgentContext } from '@aries-framework/core'

import { AriesFrameworkError } from '@aries-framework/core'

import { AnonCredsRegistryService } from '../services'

import {
  isUnqualifiedSchemaId,
  isUnqualifiedCredentialDefinitionId,
  isUnqualifiedRevocationRegistryId,
} from './indyIdentifiers'

export type FetchLedgerObjectsInput = {
  credentialDefinitionId?: string
  schemaId?: string
  revocationRegistryId?: string
}

export type FetchLedgerObjectsReturn<T extends FetchLedgerObjectsInput> = {
  credentialDefinitionReturn: T['credentialDefinitionId'] extends string ? GetCredentialDefinitionReturn : undefined
  schemaReturn: T['schemaId'] extends string ? GetSchemaReturn : undefined
  revocationRegistryDefinitionReturn: T['revocationRegistryId'] extends string
    ? GetRevocationRegistryDefinitionReturn
    : undefined
}

export async function fetchObjectsFromLedger<T extends FetchLedgerObjectsInput>(agentContext: AgentContext, input: T) {
  const { credentialDefinitionId, schemaId, revocationRegistryId } = input

  const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)

  let schemaReturn: GetSchemaReturn | undefined = undefined
  if (schemaId) {
    const result = await registryService
      .getRegistryForIdentifier(agentContext, schemaId)
      .getSchema(agentContext, schemaId)

    if (!result) throw new AriesFrameworkError('Schema not found')
    schemaReturn = result
  }

  let credentialDefinitionReturn: GetCredentialDefinitionReturn | undefined = undefined
  if (credentialDefinitionId) {
    const result = await registryService
      .getRegistryForIdentifier(agentContext, credentialDefinitionId)
      .getCredentialDefinition(agentContext, credentialDefinitionId)
    if (!result) throw new AriesFrameworkError('CredentialDefinition not found')
    credentialDefinitionReturn = result
  }

  let revocationRegistryDefinitionReturn: GetRevocationRegistryDefinitionReturn | undefined = undefined
  if (revocationRegistryId) {
    const result = await registryService
      .getRegistryForIdentifier(agentContext, revocationRegistryId)
      .getRevocationRegistryDefinition(agentContext, revocationRegistryId)
    if (!result) throw new AriesFrameworkError('RevocationRegistryDefinition not found')
    revocationRegistryDefinitionReturn = result
  }

  return {
    credentialDefinitionReturn,
    schemaReturn,
    revocationRegistryDefinitionReturn,
  } as FetchLedgerObjectsReturn<T>
}

export async function fetchQualifiedIds<T extends FetchLedgerObjectsInput & { schemaIssuerId?: string }>(
  agentContext: AgentContext,
  input: T
): Promise<T & (T['schemaId'] extends string ? { schemaIssuerId: string } : { schemaIssuerId: never })> {
  const { schemaId, credentialDefinitionId, revocationRegistryId, schemaIssuerId } = input

  let qSchemaId = schemaId ?? undefined
  let qSchemaIssuerId = schemaIssuerId ?? undefined
  if (schemaIssuerId && !schemaId) throw new AriesFrameworkError('Cannot fetch schemaIssuerId without schemaId')
  if (schemaId && (isUnqualifiedSchemaId(schemaId) || schemaId.startsWith('did:') === false)) {
    const { schemaReturn } = await fetchObjectsFromLedger(agentContext, { schemaId })
    qSchemaId = schemaReturn.schemaId

    if (schemaIssuerId && schemaIssuerId.startsWith('did') === false) {
      if (!schemaReturn.schema) throw new AriesFrameworkError('Schema not found')
      qSchemaIssuerId = schemaReturn.schema.issuerId
    }
  }

  let qCredentialDefinitionId = credentialDefinitionId ?? undefined
  if (credentialDefinitionId && isUnqualifiedCredentialDefinitionId(credentialDefinitionId)) {
    const { credentialDefinitionReturn } = await fetchObjectsFromLedger(agentContext, { credentialDefinitionId })
    qCredentialDefinitionId = credentialDefinitionReturn.credentialDefinitionId
  }

  let qRevocationRegistryId = revocationRegistryId ?? undefined
  if (revocationRegistryId && isUnqualifiedRevocationRegistryId(revocationRegistryId)) {
    const { revocationRegistryDefinitionReturn } = await fetchObjectsFromLedger(agentContext, { revocationRegistryId })
    qRevocationRegistryId = revocationRegistryDefinitionReturn.revocationRegistryDefinitionId
  }

  return {
    schemaId: qSchemaId,
    credentialDefinitionId: qCredentialDefinitionId,
    revocationRegistryId: qRevocationRegistryId,
    schemaIssuerId: qSchemaIssuerId,
  } as T & (T['schemaId'] extends string ? { schemaIssuerId: string } : { schemaIssuerId: never })
}
