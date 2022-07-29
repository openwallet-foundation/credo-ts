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

export function isQualifiedIdentifier(identifier: string | undefined): boolean {
  if (!identifier || identifier === '') return false
  return identifier.startsWith('did:indy:')
}

export function unqualifyIndyDid(qualifiedIdentifier: string): string {
  if (!isQualifiedIdentifier(qualifiedIdentifier)) return qualifiedIdentifier

  const lastColonIndex = qualifiedIdentifier.lastIndexOf(':')
  const identifierTrunk = qualifiedIdentifier.substring(lastColonIndex + 1)
  const txType = identifierTrunk.split('/')[3]

  if (txType === 'SCHEMA') {
    // did:indy:sovrin:F72i3Y3Q4i466efjYJYCHM/anoncreds/v0/SCHEMA/npdb/4.3.4 -> F72i3Y3Q4i466efjYJYCHM:2:npdb:4.3.4
    const [id, , , , name, version] = identifierTrunk.split('/')
    return generateSchemaId(id, name, version)
  } else if (txType === 'CLAIM_DEF') {
    // did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9/anoncreds/v0/CLAIM_DEF/56495/npdb -> 5nDyJVP1NrcPAttP3xwMB9:3:CL:56495:npbd
    const [id, , , , seqNo, name] = identifierTrunk.split('/')
    return generateCredentialDefinitionId(id, +seqNo, name)
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
export function getDidUrlTrunkFromSchema(schema: Schema): string {
  const namespaceIdentifier = didFromSchemaId(schema.id)
  const didUrl = `${namespaceIdentifier}/anoncreds/v0/SCHEMA/${schema.name}/${schema.version}`
  return didUrl
}

/**
 *
 * @see https://hyperledger.github.io/indy-did-method/#cred-def
 *
 */
export function getDidUrlTrunkFromCredDef(credDef: CredDef & { schemaSeqNo: number }): string {
  const namespaceIdentifier = didFromCredentialDefinitionId(credDef.id)
  return `${namespaceIdentifier}/anoncreds/v0/CLAIM_DEF/${credDef.schemaSeqNo}/${credDef.tag}`
}

export function getDidUrlTrunk(data: Schema | (CredDef & { schemaSeqNo: number })): string {
  // type (actually interface inferring type) is Schema
  if ('attrNames' in data) {
    return getDidUrlTrunkFromSchema(data)
  }
  // type (actually interface inferring type) is CredDef
  else if ('schemaId' in data) {
    return getDidUrlTrunkFromCredDef(data)
  }
  // This should never happen but let's catch it justin case
  throw new AriesFrameworkError(`Failed to construct DidUrl from ${data}. Input not conforming with Schema or CredDef`)
}

export function getQualifiedIdentifier(
  indyNamespace: string,
  data: Schema | (CredDef & { schemaSeqNo: number })
): IndyNamespace {
  if (isQualifiedIdentifier(data.id)) return data.id as IndyNamespace
  const didUrl = getDidUrlTrunk(data)
  return `did:indy:${indyNamespace}:${didUrl}`
}
