export { createRequestFromPreview } from './createRequestFromPreview'
export { sortRequestedCredentialsMatches } from './sortRequestedCredentialsMatches'
export { assertNoDuplicateGroupsNamesInProofRequest } from './hasDuplicateGroupNames'
export { areAnonCredsProofRequestsEqual } from './areRequestsEqual'
export { assertBestPracticeRevocationInterval } from './revocationInterval'
export { getRevocationRegistriesForRequest, getRevocationRegistriesForProof } from './getRevocationRegistries'
export { checkValidCredentialValueEncoding } from './credential'
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
export { legacyCredentialToW3cCredential, w3cToLegacyCredential } from './w3cUtils'

export {
  fetchCredentialDefinition,
  fetchRevocationRegistryDefinition,
  fetchSchema,
  getIndyNamespace,
  isIndyDid,
  getUnQualifiedId as getNonQualifiedId,
  getQualifiedCredentialDefinition,
  getQualifiedId,
  getQualifiedRevocationRegistryDefinition,
  getQualifiedSchema,
  getUnqualifiedCredentialDefinition,
  getUnqualifiedRevocationRegistryDefinition,
  getUnqualifiedSchema,
  isQualifiedCredentialDefinition,
  isQualifiedRevocationRegistryDefinition,
  isQualifiedSchema,
} from './ledgerObjects'
