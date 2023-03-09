/**
 * NOTE: this file is availalbe in both the indy-sdk and indy-vdr packages. If making changes to
 * this file, make sure to update both files if applicable.
 */

import { DID_INDY_REGEX } from '../../utils/did'

const didIndyAnonCredsBase =
  /(?<did>did:indy:(?<namespace>((?:[a-z][_a-z0-9-]*)(?::[a-z][_a-z0-9-]*)?)):(?<namespaceIdentifier>([1-9A-HJ-NP-Za-km-z]{21,22})))\/anoncreds\/v0/

// did:indy:<namespace>:<namespaceIdentifier>/anoncreds/v0/SCHEMA/<schemaName>/<schemaVersion>
const didIndySchemaIdRegex = new RegExp(
  `^${didIndyAnonCredsBase.source}/SCHEMA/(?<schemaName>.+)/(?<schemaVersion>[0-9.]+)$`
)

// <namespaceIdentifier>:2:<schemaName>:<schemaVersion>
const legacyIndySchemaIdRegex =
  /^(?<did>(?<namespaceIdentifier>[a-zA-Z0-9]{21,22})):2:(?<schemaName>.+):(?<schemaVersion>[0-9.]+)$/

// did:indy:<namespace>:<namespaceIdentifier>/anoncreds/v0/CLAIM_DEF/<schemaSeqNo>/<tag>
const didIndyCredentialDefinitionIdRegex = new RegExp(
  `^${didIndyAnonCredsBase.source}/CLAIM_DEF/(?<schemaSeqNo>[1-9][0-9]*)/(?<tag>.+)$`
)

// <namespaceIdentifier>:3:CL:<schemaSeqNo>:<tag>
const legacyIndyCredentialDefinitionIdRegex =
  /^(?<did>(?<namespaceIdentifier>[a-zA-Z0-9]{21,22})):3:CL:(?<schemaSeqNo>[1-9][0-9]*):(?<tag>.+)$/

// did:indy:<namespace>:<namespaceIdentifier>/anoncreds/v0/REV_REG_DEF/<schemaSeqNo>/<credentialDefinitionTag>/<revocationRegistryTag>
const didIndyRevocationRegistryIdRegex = new RegExp(
  `^${didIndyAnonCredsBase.source}/REV_REG_DEF/(?<schemaSeqNo>[1-9][0-9]*)/(?<credentialDefinitionTag>.+)/(?<revocationRegistryTag>.+)$`
)

// <namespaceIdentifier>:4:<schemaSeqNo>:3:CL:<credentialDefinitionTag>:CL_ACCUM:<revocationRegistryTag>
const legacyIndyRevocationRegistryIdRegex =
  /^(?<did>(?<namespaceIdentifier>[a-zA-Z0-9]{21,22})):4:[a-zA-Z0-9]{21,22}:3:CL:(?<schemaSeqNo>[1-9][0-9]*):(?<credentialDefinitionTag>.+):CL_ACCUM:(?<revocationRegistryTag>.+)$/

// combines both legacy and did:indy anoncreds identifiers and also the issuer id
const indyVdrAnonCredsRegexes = [
  // NOTE: we only include the qualified issuer id here, as we don't support registering objects based on legacy issuer ids.
  // you can still resolve using legacy issuer ids, but you need to use the full did:indy identifier when registering.
  // As we find a matching anoncreds registry based on the issuerId only when creating an object, this will make sure
  // it will throw an no registry found for identifier error.
  // issuer id
  DID_INDY_REGEX,

  // schema
  didIndySchemaIdRegex,
  legacyIndySchemaIdRegex,

  // credential definition
  didIndyCredentialDefinitionIdRegex,
  legacyIndyCredentialDefinitionIdRegex,

  // revocation registry
  legacyIndyRevocationRegistryIdRegex,
  didIndyRevocationRegistryIdRegex,
]

export const indyVdrAnonCredsRegistryIdentifierRegex = new RegExp(
  indyVdrAnonCredsRegexes.map((r) => r.source.replace(/(\?<[a-zA-Z]+>)?/g, '')).join('|')
)

export function getDidIndySchemaId(namespace: string, unqualifiedDid: string, name: string, version: string) {
  return `did:indy:${namespace}:${unqualifiedDid}/anoncreds/v0/SCHEMA/${name}/${version}`
}

export function getLegacySchemaId(unqualifiedDid: string, name: string, version: string) {
  return `${unqualifiedDid}:2:${name}:${version}`
}

export function getLegacyCredentialDefinitionId(unqualifiedDid: string, seqNo: string | number, tag: string) {
  return `${unqualifiedDid}:3:CL:${seqNo}:${tag}`
}

export function getDidIndyCredentialDefinitionId(
  namespace: string,
  unqualifiedDid: string,
  seqNo: string | number,
  tag: string
) {
  return `did:indy:${namespace}:${unqualifiedDid}/anoncreds/v0/CLAIM_DEF/${seqNo}/${tag}`
}

// TZQuLp43UcYTdtc3HewcDz:4:TZQuLp43UcYTdtc3HewcDz:3:CL:98158:BaustellenzertifikateNU1:CL_ACCUM:1-100
export function getLegacyRevocationRegistryId(
  unqualifiedDid: string,
  seqNo: string | number,
  credentialDefinitionTag: string,
  revocationRegistryTag: string
) {
  return `${unqualifiedDid}:4:${unqualifiedDid}:3:CL:${seqNo}:${credentialDefinitionTag}:CL_ACCUM:${revocationRegistryTag}`
}

export function getDidIndyRevocationRegistryId(
  namespace: string,
  unqualifiedDid: string,
  seqNo: string | number,
  credentialDefinitionTag: string,
  revocationRegistryTag: string
) {
  return `did:indy:${namespace}:${unqualifiedDid}/anoncreds/v0/REV_REG_DEF/${seqNo}/${credentialDefinitionTag}/${revocationRegistryTag}`
}

interface ParsedSchemaId {
  did: string
  namespaceIdentifier: string
  schemaName: string
  schemaVersion: string
  namespace?: string
}

export function parseSchemaId(schemaId: string) {
  const match = schemaId.match(didIndySchemaIdRegex) ?? schemaId.match(legacyIndySchemaIdRegex)

  if (!match) throw new Error(`Invalid schema id: ${schemaId}`)

  return match.groups as unknown as ParsedSchemaId
}

interface ParsedCredentialDefinitionId {
  did: string
  namespaceIdentifier: string
  schemaSeqNo: string
  tag: string
  namespace?: string
}

export function parseCredentialDefinitionId(credentialDefinitionId: string) {
  const match =
    credentialDefinitionId.match(didIndyCredentialDefinitionIdRegex) ??
    credentialDefinitionId.match(legacyIndyCredentialDefinitionIdRegex)

  if (!match) throw new Error(`Invalid credential definition id: ${credentialDefinitionId}`)

  return match.groups as unknown as ParsedCredentialDefinitionId
}

interface ParsedRevocationRegistryId {
  did: string
  namespaceIdentifier: string
  schemaSeqNo: string
  credentialDefinitionTag: string
  revocationRegistryTag: string
  namespace?: string
}

export function parseRevocationRegistryId(revocationRegistryId: string) {
  const match =
    revocationRegistryId.match(didIndyRevocationRegistryIdRegex) ??
    revocationRegistryId.match(legacyIndyRevocationRegistryIdRegex)

  if (!match) throw new Error(`Invalid revocation registry id: ${revocationRegistryId}`)

  return match.groups as unknown as ParsedRevocationRegistryId
}
