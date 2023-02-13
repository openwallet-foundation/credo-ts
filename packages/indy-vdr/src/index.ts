export { IndyVdrSovDidResolver } from './dids'

try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  require('@hyperledger/indy-vdr-nodejs')
} catch (error) {
  throw new Error('Error registering nodejs bindings for Indy VDR')
}

export * from './IndyVdrModule'
export * from './IndyVdrModuleConfig'
export * from './anoncreds'
export * from './pool'
