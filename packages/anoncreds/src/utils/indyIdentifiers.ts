import { CredoError } from '@credo-ts/core'

const didIndyAnonCredsBase =
  /(did:indy:((?:[a-z][_a-z0-9-]*)(?::[a-z][_a-z0-9-]*)?):([1-9A-HJ-NP-Za-km-z]{21,22}))\/anoncreds\/v0/

// did:indy:<namespace>:<namespaceIdentifier>/anoncreds/v0/SCHEMA/<schemaName>/<schemaVersion>
export const didIndySchemaIdRegex = new RegExp(`^${didIndyAnonCredsBase.source}/SCHEMA/(.+)/([0-9.]+)$`)

// did:indy:<namespace>:<namespaceIdentifier>/anoncreds/v0/CLAIM_DEF/<schemaSeqNo>/<tag>
export const didIndyCredentialDefinitionIdRegex = new RegExp(
  `^${didIndyAnonCredsBase.source}/CLAIM_DEF/([1-9][0-9]*)/(.+)$`
)

// did:indy:<namespace>:<namespaceIdentifier>/anoncreds/v0/REV_REG_DEF/<schemaSeqNo>/<credentialDefinitionTag>/<revocationRegistryTag>
export const didIndyRevocationRegistryIdRegex = new RegExp(
  `^${didIndyAnonCredsBase.source}/REV_REG_DEF/([1-9][0-9]*)/(.+)/(.+)$`
)

export const didIndyRegex = /^did:indy:((?:[a-z][_a-z0-9-]*)(?::[a-z][_a-z0-9-]*)?):([1-9A-HJ-NP-Za-km-z]{21,22})$/

export function isDidIndySchemaId(schemaId: string) {
  return didIndySchemaIdRegex.test(schemaId)
}

export function isDidIndyCredentialDefinitionId(credentialDefinitionId: string) {
  return didIndyCredentialDefinitionIdRegex.test(credentialDefinitionId)
}

export function isDidIndyRevocationRegistryId(revocationRegistryId: string) {
  return didIndyRevocationRegistryIdRegex.test(revocationRegistryId)
}

export function isIndyDid(identifier: string): boolean {
  return identifier.startsWith('did:indy:')
}

export function parseIndyDid(did: string) {
  const match = did.match(didIndyRegex)
  if (match) {
    const [, namespace, namespaceIdentifier] = match
    return { namespace, namespaceIdentifier }
  }
  throw new CredoError(`${did} is not a valid did:indy did`)
}

interface ParsedIndySchemaId {
  did: string
  namespace: string
  namespaceIdentifier: string
  schemaName: string
  schemaVersion: string
}

export function parseIndySchemaId(schemaId: string): ParsedIndySchemaId {
  const match = schemaId.match(didIndySchemaIdRegex)
  if (match) {
    const [, did, namespace, namespaceIdentifier, schemaName, schemaVersion] = match

    return {
      did,
      namespace,
      namespaceIdentifier,
      schemaName,
      schemaVersion,
    }
  }

  throw new CredoError(`Invalid did:indy schema id: ${schemaId}`)
}

interface ParsedIndyCredentialDefinitionId {
  did: string
  namespace: string
  namespaceIdentifier: string
  schemaSeqNo: string
  tag: string
}

export function parseIndyCredentialDefinitionId(credentialDefinitionId: string): ParsedIndyCredentialDefinitionId {
  const match = credentialDefinitionId.match(didIndyCredentialDefinitionIdRegex)
  if (match) {
    const [, did, namespace, namespaceIdentifier, schemaSeqNo, tag] = match

    return {
      did,
      namespace,
      namespaceIdentifier,
      schemaSeqNo,
      tag,
    }
  }

  throw new CredoError(`Invalid did:indy credential definition id: ${credentialDefinitionId}`)
}

interface ParsedIndyRevocationRegistryId {
  did: string
  namespace: string
  namespaceIdentifier: string
  schemaSeqNo: string
  credentialDefinitionTag: string
  revocationRegistryTag: string
}

export function parseIndyRevocationRegistryId(revocationRegistryId: string): ParsedIndyRevocationRegistryId {
  const match = revocationRegistryId.match(didIndyRevocationRegistryIdRegex)
  if (match) {
    const [, did, namespace, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag] = match

    return {
      did,
      namespace,
      namespaceIdentifier,
      schemaSeqNo,
      credentialDefinitionTag,
      revocationRegistryTag,
    }
  }

  throw new CredoError(`Invalid did:indy revocation registry id: ${revocationRegistryId}`)
}

export function getIndyNamespaceFromIndyDid(identifier: string): string {
  if (isDidIndySchemaId(identifier)) {
    return parseIndySchemaId(identifier).namespace
  }
  if (isDidIndyCredentialDefinitionId(identifier)) {
    return parseIndyCredentialDefinitionId(identifier).namespace
  }
  if (isDidIndyRevocationRegistryId(identifier)) {
    return parseIndyRevocationRegistryId(identifier).namespace
  }

  return parseIndyDid(identifier).namespace
}
