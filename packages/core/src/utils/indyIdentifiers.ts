// For the definitions below see also: https://hyperledger.github.io/indy-did-method/#indy-did-method-identifiers
export type Did = 'did'
export type DidIndyMethod = 'indy'
// Maybe this can be typed more strictly than string. Choosing string for now as this can be eg just `sovrin` or eg `sovrin:staging`
export type DidIndyNamespace = string
//  NOTE: because of the ambiguous nature - whether there is a colon or not within DidIndyNamespace this is the substring after the ***last*** colon
export type NamespaceIdentifier = string

// TODO: This template literal type can possibly be improved. This version leaves the substrings as potentially undefined
export type IndyNamespace = `${Did}:${DidIndyMethod}:${DidIndyNamespace}:${NamespaceIdentifier}`

export function createUnqualifiedIdentifier(qualifiedIdentifier: string): string {
  const subStrings = qualifiedIdentifier.split(':')
  return subStrings[subStrings.length - 1]
}

export function createQualifiedIdentifier(didIndyNamespace: string, namespaceIdentifier: string): IndyNamespace {
  return `did:indy:${didIndyNamespace}:${namespaceIdentifier}`
}

export function getDidFromSchemaOrCredentialDefinitionId(schemaId: string): string {
  const subStrings = schemaId.split(':')
  return subStrings[0]
}
