import 'reflect-metadata'

export { AnonCredsApi } from './AnonCredsApi'
export * from './AnonCredsApiOptions'
export { AnonCredsModule } from './AnonCredsModule'
export { AnonCredsModuleConfig, type AnonCredsModuleConfigOptions } from './AnonCredsModuleConfig'
export * from './error'
export * from './formats'
export * from './models'
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
