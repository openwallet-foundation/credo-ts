export { createRequestFromPreview } from './createRequestFromPreview'
export { sortRequestedCredentialsMatches } from './sortRequestedCredentialsMatches'
export { assertNoDuplicateGroupsNamesInProofRequest } from './hasDuplicateGroupNames'
export { areAnonCredsProofRequestsEqual } from './areRequestsEqual'
export { assertBestPracticeRevocationInterval } from './revocationInterval'
export { getRevocationRegistriesForRequest, getRevocationRegistriesForProof } from './getRevocationRegistries'
export { checkValidCredentialValueEncoding, type AnonCredsCredentialValue } from './credential'
export { IsMap } from './isMap'
export { composeCredentialAutoAccept, composeProofAutoAccept } from './composeAutoAccept'
export { areCredentialPreviewAttributesEqual } from './credentialPreviewAttributes'
export { dateToTimestamp } from './timestamp'
export { storeLinkSecret } from './linkSecret'
export {
  unqualifiedCredentialDefinitionIdRegex,
  unqualifiedIndyDidRegex,
  unqualifiedSchemaIdRegex,
  unqualifiedSchemaVersionRegex,
} from './indyIdentifiers'

export {
  fetchCredentialDefinition,
  fetchRevocationRegistryDefinition,
  fetchSchema,
  fetchRevocationStatusList,
} from './anonCredsObjects'
export {
  AnonCredsCredentialMetadataKey,
  AnonCredsCredentialRequestMetadataKey,
  W3cAnonCredsCredentialMetadataKey,
  type AnonCredsCredentialMetadata,
  type AnonCredsCredentialRequestMetadata,
  type W3cAnonCredsCredentialMetadata,
} from './metadata'
export { getW3cRecordAnonCredsTags } from './w3cAnonCredsUtils'
export { getCredentialsForAnonCredsProofRequest } from './getCredentialsForAnonCredsRequest'
