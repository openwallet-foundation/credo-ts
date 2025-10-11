import 'reflect-metadata'

export * from './models'
export * from './services'
export * from './error'
export * from './repository'
export * from './formats'
export * from './protocols'

export { AnonCredsModule } from './AnonCredsModule'
export { AnonCredsModuleConfig, type AnonCredsModuleConfigOptions } from './AnonCredsModuleConfig'
export { AnonCredsApi } from './AnonCredsApi'
export * from './AnonCredsApiOptions'
export { generateLegacyProverDidLikeString } from './utils/proverDid'
export * from './utils/indyIdentifiers'
export { assertBestPracticeRevocationInterval } from './utils/revocationInterval'
export { storeLinkSecret } from './utils/linkSecret'

export { dateToTimestamp, type AnonCredsCredentialValue, type AnonCredsCredentialMetadata } from './utils'
export {
  fetchCredentialDefinition,
  fetchRevocationRegistryDefinition,
  fetchSchema,
  fetchRevocationStatusList,
} from './utils/anonCredsObjects'

export { AnonCredsCredentialMetadataKey } from './utils/metadata'
export { getAnonCredsTagsFromRecord, type AnonCredsCredentialTags } from './utils/w3cAnonCredsUtils'
export { W3cAnonCredsCredentialMetadataKey } from './utils/metadata'
export { getCredentialsForAnonCredsProofRequest } from './utils/getCredentialsForAnonCredsRequest'
