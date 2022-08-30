import type { CredentialDefinitionTemplate, SchemaTemplate } from '../modules/ledger/services/IndyLedgerService'
import type { CredDef, Schema } from 'indy-sdk'

import { AriesFrameworkError } from '../error/AriesFrameworkError'
import { generateCredentialDefinitionId, generateSchemaId } from '../modules/ledger/ledgerUtil'

import { didFromCredentialDefinitionId, didFromSchemaId } from './did'

/**
 *
 * @see For the definitions below see also: https://hyperledger.github.io/indy-did-method/#indy-did-method-identifiers
 *
 */
export type Did = 'did'
export type DidIndyMethod = 'indy'
// Maybe this can be typed more strictly than string. Choosing string for now as this can be eg just `sovrin` or eg `sovrin:staging`
export type DidIndyNamespace = string
//  NOTE: because of the ambiguous nature - whether there is a colon or not within DidIndyNamespace this is the substring after the ***last*** colon
export type NamespaceIdentifier = string

// TODO: This template literal type can possibly be improved. This version leaves the substrings as potentially undefined
export type IndyNamespace = `${Did}:${DidIndyMethod}:${DidIndyNamespace}:${NamespaceIdentifier}`

export function isQualifiedIndyIdentifier(identifier: string | undefined): boolean {
  if (!identifier || identifier === '') return false
  return identifier.startsWith('did:indy:')
}

export function getLegacyIndyCredentialDefinitionId(qualifiedIdentifier: string) {
  if (!isQualifiedIndyIdentifier(qualifiedIdentifier))
    throw new AriesFrameworkError(
      `Identifier ${qualifiedIdentifier} not a qualified indy identifier. Hint: Needs to start with 'did:ind:'`
    )

  const lastColonIndex = qualifiedIdentifier.lastIndexOf(':')
  const identifierTrunk = qualifiedIdentifier.substring(lastColonIndex + 1)
  const txType = identifierTrunk.split('/')[3]

  if (txType === 'CLAIM_DEF') {
    // did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9/anoncreds/v0/CLAIM_DEF/56495/npdb -> 5nDyJVP1NrcPAttP3xwMB9:3:CL:56495:npbd
    const [id, , , , seqNo, name] = identifierTrunk.split('/')
    return generateCredentialDefinitionId(id, +seqNo, name)
  } else {
    // indy Union Indy Ledger w/o url syntax
    throw new AriesFrameworkError(`Provided identifier ${qualifiedIdentifier} has invalid format.`)
  }
}

export function getLegacyIndySchemaId(qualifiedIdentifier: string) {
  if (!isQualifiedIndyIdentifier(qualifiedIdentifier)) return qualifiedIdentifier

  const lastColonIndex = qualifiedIdentifier.lastIndexOf(':')
  const identifierTrunk = qualifiedIdentifier.substring(lastColonIndex + 1)
  const txType = identifierTrunk.split('/')[3]

  if (txType === 'SCHEMA') {
    // did:indy:sovrin:F72i3Y3Q4i466efjYJYCHM/anoncreds/v0/SCHEMA/npdb/4.3.4 -> F72i3Y3Q4i466efjYJYCHM:2:npdb:4.3.4
    const [id, , , , name, version] = identifierTrunk.split('/')
    return generateSchemaId(id, name, version)
  } else {
    // indy Union Indy Ledger w/o url syntax
    // did:indy:idunion:test:2MZYuPv2Km7Q1eD4GCsSb6 -> 2MZYuPv2Km7Q1eD4GCsSb6
    return identifierTrunk
  }
}

/**
 *
 * @see https://hyperledger.github.io/indy-did-method/#schema
 *
 */
export function schemaToQualifiedIndySchemaTrunk(schema: SchemaTemplate | Schema, schemaId: string): string {
  const did = didFromSchemaId(schemaId)
  const didUrl = `${did}/anoncreds/v0/SCHEMA/${schema.name}/${schema.version}`
  return didUrl
}

/**
 *
 * @see https://hyperledger.github.io/indy-did-method/#cred-def
 *
 */
export function credDefToQualifiedIndyCredDefId(
  credDefId: string,
  credDef: Omit<CredentialDefinitionTemplate, 'signatureType'> | (CredDef & { schemaSeqNo?: string })
): string {
  const did = didFromCredentialDefinitionId(credDefId)
  let seqNo
  if ('schema' in credDef) {
    seqNo = credDef.schema.seqNo
  } else if ('schemaSeqNo' in credDef) {
    seqNo = credDef.schemaSeqNo
  }
  return `${did}/anoncreds/v0/CLAIM_DEF/${seqNo}/${credDef.tag}`
}

export function getQualifiedIdentifierCredDef(
  indyNamespace: string,
  credDefId: string,
  credDef: Omit<CredentialDefinitionTemplate, 'signatureType'> | CredDef
): IndyNamespace {
  if (isQualifiedIndyIdentifier(credDefId)) return credDefId as IndyNamespace

  const didUrl = credDefToQualifiedIndyCredDefId(credDefId, credDef)
  return `did:indy:${indyNamespace}:${didUrl}`
}

export function getQualifiedIdentifierSchema(
  indyNamespace: string,
  schemaTemplate: SchemaTemplate | Schema,
  schemaId: string
): IndyNamespace {
  if (isQualifiedIndyIdentifier(schemaId)) return schemaId as IndyNamespace

  const didUrl = schemaToQualifiedIndySchemaTrunk(schemaTemplate, schemaId)
  return `did:indy:${indyNamespace}:${didUrl}`
}
