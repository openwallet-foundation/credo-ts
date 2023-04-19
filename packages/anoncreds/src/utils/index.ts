export { createRequestFromPreview } from './createRequestFromPreview'
export { sortRequestedCredentialsMatches } from './sortRequestedCredentialsMatches'
export { assertNoDuplicateGroupsNamesInProofRequest } from './hasDuplicateGroupNames'
export { areAnonCredsProofRequestsEqual } from './areRequestsEqual'
export { downloadTailsFile } from './tails'
export { assertBestPracticeRevocationInterval } from './revocationInterval'
export { getRevocationRegistriesForRequest, getRevocationRegistriesForProof } from './getRevocationRegistries'
export { encodeCredentialValue, checkValidCredentialValueEncoding } from './credential'
export { IsMap } from './isMap'
export { composeCredentialAutoAccept, composeProofAutoAccept } from './composeAutoAccept'
export { areCredentialPreviewAttributesEqual } from './credentialPreviewAttributes'
export {
  unqualifiedCredentialDefinitionIdRegex,
  unqualifiedIndyDidRegex,
  unqualifiedSchemaIdRegex,
  unqualifiedSchemaVersionRegex,
} from './indyIdentifiers'
