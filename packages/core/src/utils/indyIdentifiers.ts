import type { CredDef, Schema } from 'indy-sdk'

import { AriesFrameworkError } from '../error/AriesFrameworkError'

import { didFromCredentialDefinitionId, didFromSchemaId } from './did'

// For the definitions below see also: https://hyperledger.github.io/indy-did-method/#indy-did-method-identifiers
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
  //  get 1234/anoncreds/v0/SCHEMA/myschema/1.0.0 from did:indy:test:1234/anoncreds/v0/SCHEMA/myschema/1.0.0
  if (!isQualifiedIdentifier(qualifiedIdentifier)) return qualifiedIdentifier
  const lastColonIndex = qualifiedIdentifier.lastIndexOf(':')
  const identifierTrunk = qualifiedIdentifier.substring(lastColonIndex + 1)
  const identifierParts = identifierTrunk.split('/')
  // // create unqualified identifier of the form 1234
  return identifierParts[0]
}

export function getDidUrlTrunkFromSchema(schema: Schema): string {
  // see also: https://hyperledger.github.io/indy-did-method/#schema
  const namespaceIdentifier = didFromSchemaId(schema.id)
  const didUrl = `${namespaceIdentifier}/anoncreds/v0/SCHEMA/${schema.name}/${schema.version}`
  return didUrl
}

export function getDidUrlTrunkFromCredDef(credDef: CredDef): string {
  // see also: https://hyperledger.github.io/indy-did-method/#cred-def
  const namespaceIdentifier = didFromCredentialDefinitionId(credDef.id)
  if (isQualifiedIdentifier(credDef.schemaId)) {
    credDef.schemaId = unqualifyIndyDid(credDef.schemaId)
  }
  const didUrl = `${namespaceIdentifier}/anoncreds/v0/CLAIM_DEF/${credDef.schemaId}/${credDef.tag}`
  return didUrl
}

export function getDidUrlTrunk(data: Schema | CredDef): string {
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

export function getQualifiedIdentifier(indyNamespace: string, data: Schema | CredDef): IndyNamespace {
  if (isQualifiedIdentifier(data.id)) return data.id as IndyNamespace
  const didUrl = getDidUrlTrunk(data)
  return `did:indy:${indyNamespace}:${didUrl}`
}
