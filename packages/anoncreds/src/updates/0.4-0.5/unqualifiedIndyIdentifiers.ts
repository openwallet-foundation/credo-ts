import { CredoError } from '@credo-ts/core'

/**
 * Storage version 0.4 could contain unqualified (legacy) indy identifiers. Credo does not support
 * these identifiers anymore. The helpers in this file only exist to qualify the identifiers of the
 * records that the 0.4 to 0.5 migration converts.
 */

// <namespaceIdentifier>:2:<schemaName>:<schemaVersion>
const unqualifiedSchemaIdRegex = /^([a-zA-Z0-9]{21,22}):2:(.+):([0-9.]+)$/
// <namespaceIdentifier>:3:CL:<schemaSeqNo>:<tag>
const unqualifiedCredentialDefinitionIdRegex = /^([a-zA-Z0-9]{21,22}):3:CL:([1-9][0-9]*):(.+)$/
// <namespaceIdentifier>:4:<namespaceIdentifier>:3:CL:<schemaSeqNo>:<credentialDefinitionTag>:CL_ACCUM:<revocationRegistryTag>
const unqualifiedRevocationRegistryIdRegex =
  /^([a-zA-Z0-9]{21,22}):4:[a-zA-Z0-9]{21,22}:3:CL:([1-9][0-9]*):(.+):CL_ACCUM:(.+)$/
// <namespaceIdentifier> or did:sov:<namespaceIdentifier>
const unqualifiedIndyDidRegex = /^(did:sov:)?([a-zA-Z0-9]{21,22})$/

export function isUnqualifiedIndyDid(did: string) {
  return unqualifiedIndyDidRegex.test(did)
}

export function isUnqualifiedCredentialDefinitionId(credentialDefinitionId: string) {
  return unqualifiedCredentialDefinitionIdRegex.test(credentialDefinitionId)
}

/**
 * Returns the namespace identifier of an unqualified indy did. The did can have a `did:sov:` prefix.
 */
export function getUnqualifiedIndyDidNamespaceIdentifier(did: string) {
  const match = did.match(unqualifiedIndyDidRegex)
  if (!match) {
    throw new CredoError(`'${did}' is not an unqualified indy did`)
  }

  return match[2]
}

/**
 * Converts an unqualified indy identifier (did, schema id, credential definition id or revocation
 * registry id) into the did:indy identifier for the namespace. A did:indy identifier is returned as is.
 */
export function getQualifiedDidIndyDid(identifier: string, namespace: string): string {
  if (identifier.startsWith('did:indy:')) return identifier

  const schemaMatch = identifier.match(unqualifiedSchemaIdRegex)
  if (schemaMatch) {
    const [, namespaceIdentifier, schemaName, schemaVersion] = schemaMatch
    return `did:indy:${namespace}:${namespaceIdentifier}/anoncreds/v0/SCHEMA/${schemaName}/${schemaVersion}`
  }

  const credentialDefinitionMatch = identifier.match(unqualifiedCredentialDefinitionIdRegex)
  if (credentialDefinitionMatch) {
    const [, namespaceIdentifier, schemaSeqNo, tag] = credentialDefinitionMatch
    return `did:indy:${namespace}:${namespaceIdentifier}/anoncreds/v0/CLAIM_DEF/${schemaSeqNo}/${tag}`
  }

  const revocationRegistryMatch = identifier.match(unqualifiedRevocationRegistryIdRegex)
  if (revocationRegistryMatch) {
    const [, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag] = revocationRegistryMatch
    return `did:indy:${namespace}:${namespaceIdentifier}/anoncreds/v0/REV_REG_DEF/${schemaSeqNo}/${credentialDefinitionTag}/${revocationRegistryTag}`
  }

  if (isUnqualifiedIndyDid(identifier)) {
    return `did:indy:${namespace}:${getUnqualifiedIndyDidNamespaceIdentifier(identifier)}`
  }

  throw new CredoError(`Cannot create a did:indy identifier for '${identifier}' with namespace '${namespace}'`)
}
