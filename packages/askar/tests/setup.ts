import 'reflect-metadata'

try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  require('@hyperledger/aries-askar-nodejs')
} catch (error) {
  throw new Error('Could not load aries-askar bindings')
}

// FIXME: Remove when Askar JS Wrapper performance issues are solved
jest.setTimeout(180000)
