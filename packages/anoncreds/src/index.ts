import 'reflect-metadata'

export * from './models'
export * from './services'
export * from './error'
export * from './repository'
export * from './formats'
export * from './protocols'

export { AnonCredsModule } from './AnonCredsModule'
export { AnonCredsModuleConfig, AnonCredsModuleConfigOptions } from './AnonCredsModuleConfig'
export { AnonCredsApi } from './AnonCredsApi'
export * from './AnonCredsApiOptions'
export { generateLegacyProverDidLikeString } from './utils/proverDid'
export * from './utils/indyIdentifiers'
export { assertBestPracticeRevocationInterval } from './utils/revocationInterval'
export { storeLinkSecret } from './utils/linkSecret'

export { dateToTimestamp, AnonCredsCredentialValue, AnonCredsCredentialMetadata } from './utils'
export {
  fetchCredentialDefinition,
  fetchRevocationRegistryDefinition,
  fetchSchema,
  fetchRevocationStatusList,
} from './utils/anonCredsObjects'
