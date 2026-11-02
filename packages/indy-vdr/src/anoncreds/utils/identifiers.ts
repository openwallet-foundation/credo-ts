import {
  didIndyCredentialDefinitionIdRegex,
  didIndyRegex,
  didIndyRevocationRegistryIdRegex,
  didIndySchemaIdRegex,
} from '@credo-ts/anoncreds'

const indyVdrAnonCredsRegexes = [
  // issuer id
  didIndyRegex,

  // schema
  didIndySchemaIdRegex,

  // credential definition
  didIndyCredentialDefinitionIdRegex,

  // revocation registry
  didIndyRevocationRegistryIdRegex,
]

export const indyVdrAnonCredsRegistryIdentifierRegex = new RegExp(
  indyVdrAnonCredsRegexes.map((r) => r.source).join('|')
)

/**
 * The did:indy spec percent-encodes the schema name and tags in DID URLs (RFC 3986 section 2). Agents without
 * support for this can't resolve encoded ids, so encoding is opt-in.
 */
function encodeSegment(segment: string, percentEncode: boolean) {
  return percentEncode ? encodeURIComponent(segment) : segment
}

export function getDidIndySchemaId(
  namespace: string,
  unqualifiedDid: string,
  name: string,
  version: string,
  percentEncode = false
) {
  return `did:indy:${namespace}:${unqualifiedDid}/anoncreds/v0/SCHEMA/${encodeSegment(name, percentEncode)}/${version}`
}

export function getDidIndyCredentialDefinitionId(
  namespace: string,
  unqualifiedDid: string,
  schemaSeqNo: string | number,
  tag: string,
  percentEncode = false
) {
  return `did:indy:${namespace}:${unqualifiedDid}/anoncreds/v0/CLAIM_DEF/${schemaSeqNo}/${encodeSegment(tag, percentEncode)}`
}

export function getDidIndyRevocationRegistryDefinitionId(
  namespace: string,
  unqualifiedDid: string,
  schemaSeqNo: string | number,
  credentialDefinitionTag: string,
  revocationRegistryTag: string,
  percentEncode = false
) {
  return `did:indy:${namespace}:${unqualifiedDid}/anoncreds/v0/REV_REG_DEF/${schemaSeqNo}/${encodeSegment(credentialDefinitionTag, percentEncode)}/${encodeSegment(revocationRegistryTag, percentEncode)}`
}

export function getDidIndyRevocationRegistryEntryId(
  namespace: string,
  unqualifiedDid: string,
  schemaSeqNo: string | number,
  credentialDefinitionTag: string,
  revocationRegistryTag: string,
  percentEncode = false
) {
  return `did:indy:${namespace}:${unqualifiedDid}/anoncreds/v0/REV_REG_ENTRY/${schemaSeqNo}/${encodeSegment(credentialDefinitionTag, percentEncode)}/${encodeSegment(revocationRegistryTag, percentEncode)}`
}

/**
 * The indy ledger identifies AnonCreds objects with the unqualified identifier format in its transactions.
 * The functions below create these ledger identifiers from the parts of a did:indy identifier.
 */

// <namespaceIdentifier>:2:<schemaName>:<schemaVersion>
export function getIndyLedgerSchemaId(namespaceIdentifier: string, name: string, version: string) {
  return `${namespaceIdentifier}:2:${name}:${version}`
}

// <namespaceIdentifier>:3:CL:<schemaSeqNo>:<tag>
export function getIndyLedgerCredentialDefinitionId(
  namespaceIdentifier: string,
  schemaSeqNo: string | number,
  tag: string
) {
  return `${namespaceIdentifier}:3:CL:${schemaSeqNo}:${tag}`
}

// <namespaceIdentifier>:4:<namespaceIdentifier>:3:CL:<schemaSeqNo>:<credentialDefinitionTag>:CL_ACCUM:<revocationRegistryTag>
export function getIndyLedgerRevocationRegistryDefinitionId(
  namespaceIdentifier: string,
  schemaSeqNo: string | number,
  credentialDefinitionTag: string,
  revocationRegistryTag: string
) {
  return `${namespaceIdentifier}:4:${namespaceIdentifier}:3:CL:${schemaSeqNo}:${credentialDefinitionTag}:CL_ACCUM:${revocationRegistryTag}`
}
