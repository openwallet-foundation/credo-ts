export * from './dids'
export * from './error'
export * from './pool'

try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  require('indy-vdr-test-nodejs')
} catch (error) {
  throw new Error('Error registering nodejs bindings for Indy VDR')
}
