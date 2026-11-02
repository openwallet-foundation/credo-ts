import type { BaseRecord, Query, SimpleQuery } from '@credo-ts/core'
import { CredoError } from '@credo-ts/core'
import type { AnonCredsProofRequest, AnonCredsProofRequestRestriction } from '../models'

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

/**
 * Decodes a percent-encoded did:indy DID URL path segment. Identifiers created before Credo encoded these
 * segments are returned as is when they aren't valid percent-encoding.
 */
function decodeDidIndyPathSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

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
      schemaName: decodeDidIndyPathSegment(schemaName),
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
      tag: decodeDidIndyPathSegment(tag),
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
      credentialDefinitionTag: decodeDidIndyPathSegment(credentialDefinitionTag),
      revocationRegistryTag: decodeDidIndyPathSegment(revocationRegistryTag),
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

/**
 * Formats a did:indy schema, credential definition or revocation registry id with `encode` applied to the
 * schema name and tags. Returns `undefined` for other ids.
 */
function formatDidIndyIdentifier(identifier: string, encode: (segment: string) => string) {
  if (isDidIndySchemaId(identifier)) {
    const { did, schemaName, schemaVersion } = parseIndySchemaId(identifier)
    return `${did}/anoncreds/v0/SCHEMA/${encode(schemaName)}/${schemaVersion}`
  }
  if (isDidIndyCredentialDefinitionId(identifier)) {
    const { did, schemaSeqNo, tag } = parseIndyCredentialDefinitionId(identifier)
    return `${did}/anoncreds/v0/CLAIM_DEF/${schemaSeqNo}/${encode(tag)}`
  }
  if (isDidIndyRevocationRegistryId(identifier)) {
    const { did, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag } =
      parseIndyRevocationRegistryId(identifier)
    return `${did}/anoncreds/v0/REV_REG_DEF/${schemaSeqNo}/${encode(credentialDefinitionTag)}/${encode(revocationRegistryTag)}`
  }

  return undefined
}

/**
 * Returns a did:indy schema, credential definition or revocation registry id in both its percent-encoded
 * and unencoded form, as both refer to the same object. Other ids are returned as is.
 */
export function getDidIndyIdentifierVariants(identifier: string): string[] {
  return [
    ...new Set([
      identifier,
      formatDidIndyIdentifier(identifier, encodeURIComponent) ?? identifier,
      formatDidIndyIdentifier(identifier, (segment) => segment) ?? identifier,
    ]),
  ]
}

/**
 * Whether two ids refer to the same object, also when one is a percent-encoded did:indy id and the other isn't.
 */
export function areDidIndyIdentifiersEqual(identifierA: string | undefined, identifierB: string | undefined) {
  if (identifierA === undefined || identifierB === undefined) return identifierA === identifierB
  return identifierA === identifierB || getDidIndyIdentifierVariants(identifierA).includes(identifierB)
}

/**
 * Query that matches `tagName` against every form of a did:indy id.
 */
// biome-ignore lint/suspicious/noExplicitAny: matches the Query type of core
export function didIndyIdentifierQuery<T extends BaseRecord<any, any, any>>(
  tagName: string,
  identifier: string
): Query<T> {
  const variants = getDidIndyIdentifierVariants(identifier)
  if (variants.length === 1) return { [tagName]: identifier } as Query<T>

  return { $or: variants.map((variant) => ({ [tagName]: variant }) as Query<T>) }
}

/**
 * Query for `query` where each of the `tagNames` matches every form of a did:indy id.
 */
// biome-ignore lint/suspicious/noExplicitAny: matches the Query type of core
export function withDidIndyIdentifierQueryVariants<T extends BaseRecord<any, any, any>>(
  query: SimpleQuery<T>,
  tagNames: string[]
): Query<T> {
  const simpleQuery: Record<string, unknown> = { ...query }
  const identifierQueries: Query<T>[] = []

  for (const tagName of tagNames) {
    const identifier = simpleQuery[tagName]
    if (typeof identifier !== 'string' || getDidIndyIdentifierVariants(identifier).length === 1) continue

    delete simpleQuery[tagName]
    identifierQueries.push(didIndyIdentifierQuery<T>(tagName, identifier))
  }

  if (identifierQueries.length === 0) return query
  return { $and: [simpleQuery as SimpleQuery<T>, ...identifierQueries] }
}

/**
 * Adds an entry under every form of each did:indy id key, as anoncreds-rs looks objects up by the exact id in
 * the credential or presentation.
 */
export function withDidIndyIdentifierVariantKeys<T>(objects: Record<string, T>): Record<string, T> {
  const withVariants: Record<string, T> = {}
  for (const [identifier, object] of Object.entries(objects)) {
    for (const variant of getDidIndyIdentifierVariants(identifier)) {
      withVariants[variant] ??= object
    }
  }

  // Keys passed in always win over a variant of another key
  return { ...withVariants, ...objects }
}

/**
 * Adds a restriction for each form of the did:indy ids in the restrictions, so they match credentials
 * with the id in either form.
 */
export function withDidIndyRestrictionVariants(
  restrictions: AnonCredsProofRequestRestriction[]
): AnonCredsProofRequestRestriction[] {
  return restrictions.flatMap((restriction) => {
    let expanded = [restriction]
    for (const key of ['schema_id', 'cred_def_id', 'rev_reg_id'] as const) {
      const identifier = restriction[key]
      if (!identifier) continue

      expanded = expanded.flatMap((r) =>
        getDidIndyIdentifierVariants(identifier).map((variant) => ({ ...r, [key]: variant }))
      )
    }
    return expanded
  })
}

export function withDidIndyProofRequestRestrictionVariants(proofRequest: AnonCredsProofRequest): AnonCredsProofRequest {
  const withVariants = <T extends { restrictions?: AnonCredsProofRequestRestriction[] }>(items: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(items).map(([referent, item]) => [
        referent,
        item.restrictions ? { ...item, restrictions: withDidIndyRestrictionVariants(item.restrictions) } : item,
      ])
    )

  return {
    ...proofRequest,
    requested_attributes: withVariants(proofRequest.requested_attributes),
    requested_predicates: withVariants(proofRequest.requested_predicates),
  }
}

/**
 * Returns the restriction with its did:indy ids in percent-encoded form, so restrictions can be compared.
 */
export function getCanonicalDidIndyRestriction(
  restriction: AnonCredsProofRequestRestriction
): AnonCredsProofRequestRestriction {
  const canonical = { ...restriction }
  for (const key of ['schema_id', 'cred_def_id', 'rev_reg_id'] as const) {
    const identifier = canonical[key]
    if (identifier) canonical[key] = formatDidIndyIdentifier(identifier, encodeURIComponent) ?? identifier
  }
  return canonical
}
