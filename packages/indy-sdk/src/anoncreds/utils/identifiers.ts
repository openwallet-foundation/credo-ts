export function getIndySeqNoFromUnqualifiedCredentialDefinitionId(unqualifiedCredentialDefinitionId: string): number {
  // 5nDyJVP1NrcPAttP3xwMB9:3:CL:56495:npbd
  const [, , , seqNo] = unqualifiedCredentialDefinitionId.split(':')

  return Number(seqNo)
}

export function getLegacySchemaId(unqualifiedDid: string, name: string, version: string) {
  return `${unqualifiedDid}:2:${name}:${version}`
}

export function getLegacyCredentialDefinitionId(unqualifiedDid: string, seqNo: number, tag: string) {
  return `${unqualifiedDid}:3:CL:${seqNo}:${tag}`
}

/**
 * Extract did from schema id
 */
export function didFromSchemaId(schemaId: string) {
  const [did] = schemaId.split(':')

  return did
}

/**
 * Extract did from credential definition id
 */
export function didFromCredentialDefinitionId(credentialDefinitionId: string) {
  const [did] = credentialDefinitionId.split(':')

  return did
}

/**
 * Extract did from revocation registry definition id
 */
export function didFromRevocationRegistryDefinitionId(revocationRegistryId: string) {
  const [did] = revocationRegistryId.split(':')

  return did
}
