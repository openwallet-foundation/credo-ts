import 'reflect-metadata'

export {
  ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE,
  AnonCredsW3cCredentialProof,
  AnonCredsW3cCredentialServiceSymbol,
  type IAnonCredsW3cCredentialService,
} from '@credo-ts/core'
export { AnonCredsApi } from './AnonCredsApi'
export * from './AnonCredsApiOptions'
export { AnonCredsModule } from './AnonCredsModule'
export {
  AnonCredsModuleConfig,
  type AnonCredsModuleConfigOptions,
  type NativeAnoncredsLike,
} from './AnonCredsModuleConfig'
export * from './error'
/**
 * @deprecated Import DIDComm formats and services from `@credo-ts/anoncreds/didcomm`.
 */
export * from './formats'
export * from './models'
/**
 * @deprecated Import DIDComm protocols from `@credo-ts/anoncreds/didcomm`.
 */
export * from './protocols'
export * from './repository'
export * from './services'
export { type AnonCredsCredentialMetadata, type AnonCredsCredentialValue, dateToTimestamp } from './utils'
export {
  fetchCredentialDefinition,
  fetchRevocationRegistryDefinition,
  fetchRevocationStatusList,
  fetchSchema,
} from './utils/anonCredsObjects'
export { getCredentialsForAnonCredsProofRequest } from './utils/getCredentialsForAnonCredsRequest'
export * from './utils/indyIdentifiers'
export { storeLinkSecret } from './utils/linkSecret'
export { AnonCredsCredentialMetadataKey, W3cAnonCredsCredentialMetadataKey } from './utils/metadata'
export { generateLegacyProverDidLikeString } from './utils/proverDid'
export { assertBestPracticeRevocationInterval } from './utils/revocationInterval'
export { type AnonCredsCredentialTags, getAnonCredsTagsFromRecord } from './utils/w3cAnonCredsUtils'
