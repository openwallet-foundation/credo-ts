export const legacyIndySchemaIdRegex = /^[a-zA-Z0-9]{21,22}:2:.+:[0-9.]+$/
export const legacyIndySchemaVersionRegex = /^(\d+\.)?(\d+\.)?(\*|\d+)$/
export const legacyIndyCredentialDefinitionIdRegex =
  /^([a-zA-Z0-9]{21,22}):3:CL:(([1-9][0-9]*)|([a-zA-Z0-9]{21,22}:2:.+:[0-9.]+)):(.+)?$/
export const legacyIndyDidRegex = /^(did:sov:)?[a-zA-Z0-9]{21,22}$/
