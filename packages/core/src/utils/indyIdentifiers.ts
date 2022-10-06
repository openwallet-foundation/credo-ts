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

export function isQualifiedIndyIdentifier(identifier: string | undefined): identifier is IndyNamespace {
  if (!identifier || identifier === '') return false
  return identifier.startsWith('did:indy:')
}

export function getQualifiedIndyCredentialDefinitionId(
  indyNamespace: string,
  unqualifiedCredentialDefinitionId: string
): IndyNamespace {
  if (isQualifiedIndyIdentifier(unqualifiedCredentialDefinitionId)) return unqualifiedCredentialDefinitionId

  // 5nDyJVP1NrcPAttP3xwMB9:3:CL:56495:npbd
  const [did, , , seqNo, tag] = unqualifiedCredentialDefinitionId.split(':')

  return `did:indy:${indyNamespace}:${did}/anoncreds/v0/CLAIM_DEF/${seqNo}/${tag}`
}

/**
 *
 * @see https://hyperledger.github.io/indy-did-method/#schema
 *
 */
export function getQualifiedIndySchemaId(indyNamespace: string, schemaId: string): IndyNamespace {
  if (isQualifiedIndyIdentifier(schemaId)) return schemaId

  // F72i3Y3Q4i466efjYJYCHM:2:npdb:4.3.4
  const [did, , schemaName, schemaVersion] = schemaId.split(':')

  return `did:indy:${indyNamespace}:${did}/anoncreds/v0/SCHEMA/${schemaName}/${schemaVersion}`
}

export function getLegacySchemaId(unqualifiedDid: string, name: string, version: string) {
  return `${unqualifiedDid}:2:${name}:${version}`
}

export function getLegacyCredentialDefinitionId(unqualifiedDid: string, seqNo: number, tag: string) {
  return `${unqualifiedDid}:3:CL:${seqNo}:${tag}`
}
