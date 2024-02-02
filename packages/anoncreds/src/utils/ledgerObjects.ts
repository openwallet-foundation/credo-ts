import type { AnonCredsCredentialDefinition, AnonCredsRevocationRegistryDefinition, AnonCredsSchema } from '../models'
import type { AgentContext } from '@credo-ts/core'

import { isDid, CredoError } from '@credo-ts/core'

import { AnonCredsRegistryService } from '../services'

import {
  getUnqualifiedCredentialDefinitionId,
  getUnqualifiedRevocationRegistryDefinitionId,
  getUnqualifiedSchemaId,
  isDidIndyCredentialDefinitionId,
  isDidIndyRevocationRegistryId,
  isDidIndySchemaId,
  isUnqualifiedCredentialDefinitionId,
  isUnqualifiedRevocationRegistryId,
  isUnqualifiedSchemaId,
  parseIndyCredentialDefinitionId,
  parseIndyDid,
  parseIndyRevocationRegistryId,
  parseIndySchemaId,
} from './indyIdentifiers'

type WithIds<input extends object> = input & { qualifiedId: string; id: string }

type ReturnHelper<input, output extends object> = input extends string
  ? WithIds<output>
  : input extends string | undefined
  ? WithIds<output> | undefined
  : undefined

export function getIndyNamespace(identifier: string): string {
  if (!isIndyDid(identifier)) throw new CredoError(`Cannot get indy namespace of identifier '${identifier}'`)
  if (isDidIndySchemaId(identifier)) {
    const { namespace } = parseIndySchemaId(identifier)
    if (!namespace) throw new CredoError(`Cannot get indy namespace of identifier '${identifier}'`)
    return namespace
  } else if (isDidIndyCredentialDefinitionId(identifier)) {
    const { namespace } = parseIndyCredentialDefinitionId(identifier)
    if (!namespace) throw new CredoError(`Cannot get indy namespace of identifier '${identifier}'`)
    return namespace
  } else if (isDidIndyRevocationRegistryId(identifier)) {
    const { namespace } = parseIndyRevocationRegistryId(identifier)
    if (!namespace) throw new CredoError(`Cannot get indy namespace of identifier '${identifier}'`)
    return namespace
  }

  const { namespace } = parseIndyDid(identifier)
  return namespace
}

export function getUnQualifiedId(identifier: string): string {
  if (!isDid(identifier)) return identifier
  if (!isIndyDid(identifier)) throw new CredoError(`Cannot get unqualified id of identifier '${identifier}'`)

  if (isDidIndySchemaId(identifier)) {
    const { schemaName, schemaVersion, namespaceIdentifier } = parseIndySchemaId(identifier)
    return getUnqualifiedSchemaId(namespaceIdentifier, schemaName, schemaVersion)
  } else if (isDidIndyCredentialDefinitionId(identifier)) {
    const { schemaSeqNo, tag, namespaceIdentifier } = parseIndyCredentialDefinitionId(identifier)
    return getUnqualifiedCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, tag)
  } else if (isDidIndyRevocationRegistryId(identifier)) {
    const { namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag } =
      parseIndyRevocationRegistryId(identifier)
    return getUnqualifiedRevocationRegistryDefinitionId(
      namespaceIdentifier,
      schemaSeqNo,
      credentialDefinitionTag,
      revocationRegistryTag
    )
  }

  const { namespaceIdentifier } = parseIndyDid(identifier)
  return namespaceIdentifier
}

export function isIndyDid(identifier: string): boolean {
  return identifier.startsWith('did:indy:')
}

export function getQualifiedId(identifier: string, namespace: string) {
  const isQualifiedDid = isDid(identifier)
  if (isQualifiedDid) return identifier

  if (!namespace || typeof namespace !== 'string') {
    throw new CredoError('Missing required indy namespace')
  }

  if (isUnqualifiedSchemaId(identifier)) {
    const { namespaceIdentifier, schemaName, schemaVersion } = parseIndySchemaId(identifier)
    const schemaId = `did:indy:${namespace}:${namespaceIdentifier}/anoncreds/v0/SCHEMA/${schemaName}/${schemaVersion}`
    //if (isDidIndySchemaId(schemaId)) throw new Error(`schemaid conversion error: ${schemaId}`)
    return schemaId
  } else if (isUnqualifiedCredentialDefinitionId(identifier)) {
    const { namespaceIdentifier, schemaSeqNo, tag } = parseIndyCredentialDefinitionId(identifier)
    const credentialDefinitionId = `did:indy:${namespace}:${namespaceIdentifier}/anoncreds/v0/CLAIM_DEF/${schemaSeqNo}/${tag}`
    //if (isDidIndyCredentialDefinitionId(credentialDefinitionId))
    //  throw new Error(`credentialdefintiion id conversion error: ${credentialDefinitionId}`)
    return credentialDefinitionId
  } else if (isUnqualifiedRevocationRegistryId(identifier)) {
    const { namespaceIdentifier, schemaSeqNo, revocationRegistryTag } = parseIndyRevocationRegistryId(identifier)
    const revocationRegistryId = `did:indy:${namespace}:${namespaceIdentifier}/anoncreds/v0/REV_REG_DEF/${schemaSeqNo}/${revocationRegistryTag}`
    //if (isDidIndyRevocationRegistryId(revocationRegistryId))
    //  throw new Error(`revocationregistry id conversion error: ${revocationRegistryId}`)
    return revocationRegistryId
  }

  return `did:indy:${namespace}:${identifier}`
}

export function getUnqualifiedSchema(schema: AnonCredsSchema): AnonCredsSchema {
  if (!isIndyDid(schema.issuerId)) return schema
  const issuerId = getUnQualifiedId(schema.issuerId)

  return { ...schema, issuerId }
}

export function isQualifiedSchema(schema: AnonCredsSchema) {
  return isDid(schema.issuerId)
}

export function getQualifiedSchema(schema: AnonCredsSchema, namespace: string): AnonCredsSchema {
  if (isQualifiedSchema(schema)) return schema

  return {
    ...schema,
    issuerId: getQualifiedId(schema.issuerId, namespace),
  }
}

export async function fetchSchema(
  agentContext: AgentContext,
  schemaId: string
): Promise<
  ReturnHelper<
    string,
    WithIds<{ schema: AnonCredsSchema; qualifiedSchema: AnonCredsSchema; unqualifiedSchema: AnonCredsSchema }>
  >
> {
  const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)

  const result = await registryService
    .getRegistryForIdentifier(agentContext, schemaId)
    .getSchema(agentContext, schemaId)
  if (!result || !result.schema) {
    throw new CredoError(`Schema not found for id ${schemaId}: ${result.resolutionMetadata.message}`)
  }

  const indyNamespace = result.schemaMetadata.didIndyNamespace

  const schema = result.schema
  const qualifiedSchema = getQualifiedSchema(schema, indyNamespace as string)
  const unqualifiedSchema = getUnqualifiedSchema(schema)

  return {
    schema,
    id: schemaId,
    qualifiedId: getQualifiedId(schemaId, indyNamespace as string),
    qualifiedSchema,
    unqualifiedSchema,
  }
}

export function getUnqualifiedCredentialDefinition(
  anonCredsCredentialDefinition: AnonCredsCredentialDefinition
): AnonCredsCredentialDefinition {
  if (!isIndyDid(anonCredsCredentialDefinition.issuerId) || !isIndyDid(anonCredsCredentialDefinition.schemaId)) {
    return anonCredsCredentialDefinition
  }
  const issuerId = getUnQualifiedId(anonCredsCredentialDefinition.issuerId)
  const schemaId = getUnQualifiedId(anonCredsCredentialDefinition.schemaId)

  return { ...anonCredsCredentialDefinition, issuerId, schemaId }
}

export function isQualifiedCredentialDefinition(anonCredsCredentialDefinition: AnonCredsCredentialDefinition) {
  return isDid(anonCredsCredentialDefinition.issuerId) && isDid(anonCredsCredentialDefinition.schemaId)
}

export function getQualifiedCredentialDefinition(
  anonCredsCredentialDefinition: AnonCredsCredentialDefinition,
  namespace: string
): AnonCredsCredentialDefinition {
  if (isQualifiedCredentialDefinition(anonCredsCredentialDefinition)) return { ...anonCredsCredentialDefinition }

  return {
    ...anonCredsCredentialDefinition,
    issuerId: getQualifiedId(anonCredsCredentialDefinition.issuerId, namespace),
    schemaId: getQualifiedId(anonCredsCredentialDefinition.schemaId, namespace),
  }
}

export async function fetchCredentialDefinition(
  agentContext: AgentContext,
  credentialDefinitionId: string
): Promise<
  ReturnHelper<
    string,
    WithIds<{
      credentialDefinition: AnonCredsCredentialDefinition
      qualifiedCredentialDefinition: AnonCredsCredentialDefinition
      unqualifiedCredentialDefinition: AnonCredsCredentialDefinition
    }>
  >
> {
  const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)

  const result = await registryService
    .getRegistryForIdentifier(agentContext, credentialDefinitionId)
    .getCredentialDefinition(agentContext, credentialDefinitionId)
  if (!result || !result.credentialDefinition) {
    throw new CredoError(`Schema not found for id ${credentialDefinitionId}: ${result.resolutionMetadata.message}`)
  }

  const indyNamespace = result.credentialDefinitionMetadata.didIndyNamespace

  const credentialDefinition = result.credentialDefinition
  const qualifiedCredentialDefinition = getQualifiedCredentialDefinition(credentialDefinition, indyNamespace as string)
  const unqualifiedCredentialDefinition = getUnqualifiedCredentialDefinition(credentialDefinition)

  return {
    credentialDefinition,
    id: credentialDefinitionId,
    qualifiedId: getQualifiedId(credentialDefinitionId, indyNamespace as string),
    qualifiedCredentialDefinition,
    unqualifiedCredentialDefinition,
  }
}

export function getUnqualifiedRevocationRegistryDefinition(
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
): AnonCredsRevocationRegistryDefinition {
  if (!isIndyDid(revocationRegistryDefinition.issuerId) || !isIndyDid(revocationRegistryDefinition.credDefId)) {
    return revocationRegistryDefinition
  }

  const issuerId = getUnQualifiedId(revocationRegistryDefinition.issuerId)
  const credDefId = getUnQualifiedId(revocationRegistryDefinition.credDefId)

  return { ...revocationRegistryDefinition, issuerId, credDefId }
}

export function isQualifiedRevocationRegistryDefinition(
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
) {
  return isDid(revocationRegistryDefinition.issuerId) && isDid(revocationRegistryDefinition.credDefId)
}

export function getQualifiedRevocationRegistryDefinition(
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition,
  namespace: string
): AnonCredsRevocationRegistryDefinition {
  if (isQualifiedRevocationRegistryDefinition(revocationRegistryDefinition)) return { ...revocationRegistryDefinition }

  return {
    ...revocationRegistryDefinition,
    issuerId: getQualifiedId(revocationRegistryDefinition.issuerId, namespace),
    credDefId: getQualifiedId(revocationRegistryDefinition.credDefId, namespace),
  }
}

export async function fetchRevocationRegistryDefinition(
  agentContext: AgentContext,
  revocationRegistryDefinitionId: string
): Promise<
  ReturnHelper<
    string,
    WithIds<{
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
      qualifiedRevocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
      unqualifiedRevocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }>
  >
> {
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

  const revocationRegistryDefinition = result.revocationRegistryDefinition
  const qualifiedRevocationRegistryDefinition = getQualifiedRevocationRegistryDefinition(
    revocationRegistryDefinition,
    indyNamespace as string
  )
  const unqualifiedRevocationRegistryDefinition = getUnqualifiedRevocationRegistryDefinition(
    qualifiedRevocationRegistryDefinition
  )

  return {
    revocationRegistryDefinition,
    id: revocationRegistryDefinitionId,
    qualifiedId: getQualifiedId(revocationRegistryDefinitionId, indyNamespace as string),
    qualifiedRevocationRegistryDefinition,
    unqualifiedRevocationRegistryDefinition,
  }
}
