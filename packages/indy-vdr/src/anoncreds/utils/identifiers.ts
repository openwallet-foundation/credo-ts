export const legacyIndyVdrIssuerIdRegex = /^[a-zA-Z0-9]{21,22}$/
export const legacyIndyVdrSchemaIdRegex = /^[a-zA-Z0-9]{21,22}:2:.+:[0-9.]+$/
export const legacyIndyVdrCredentialDefinitionIdRegex =
  /^[a-zA-Z0-9]{21,22}:3:CL:(([1-9][0-9]*)|([a-zA-Z0-9]{21,22}:2:.+:[0-9.]+)):(.+)?$/
export const legacyIndyVdrRevocationRegistryIdRegex =
  /^[a-zA-Z0-9]{21,22}:4:[a-zA-Z0-9]{21,22}:3:CL:(([1-9][0-9]*)|([a-zA-Z0-9]{21,22}:2:.+:[0-9.]+))(:.+)?:CL_ACCUM:(.+$)/

export const indyVdrAnonCredsRegistryIdentifierRegex = new RegExp(
  `${legacyIndyVdrIssuerIdRegex.source}|${legacyIndyVdrSchemaIdRegex.source}|${legacyIndyVdrCredentialDefinitionIdRegex.source}|${legacyIndyVdrRevocationRegistryIdRegex.source}`
)

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

export function didFromRevocationRegistryDefinitionId(revocationRegistryId: string) {
  const [did] = revocationRegistryId.split(':')

  return did
}
