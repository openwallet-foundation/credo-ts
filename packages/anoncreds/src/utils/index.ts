export { createRequestFromPreview } from './createRequestFromPreview'
export { sortRequestedCredentialsMatches } from './sortRequestedCredentialsMatches'
export { assertNoDuplicateGroupsNamesInProofRequest } from './hasDuplicateGroupNames'
export { areAnonCredsProofRequestsEqual } from './areRequestsEqual'
export { downloadTailsFile } from './tails'
export { assertRevocationInterval } from './revocationInterval'
export { encodeCredentialValue, checkValidCredentialValueEncoding } from './credential'
export { IsMap } from './isMap'
export { composeCredentialAutoAccept, composeProofAutoAccept } from './composeAutoAccept'
export { areCredentialPreviewAttributesEqual } from './credentialPreviewAttributes'
export {
  legacyIndyCredentialDefinitionIdRegex,
  legacyIndyDidRegex,
  legacyIndySchemaIdRegex,
  legacyIndySchemaVersionRegex,
} from './legacyIndyIdentifiers'
