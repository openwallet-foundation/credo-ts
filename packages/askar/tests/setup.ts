import 'reflect-metadata'

jest.setTimeout(180000)

try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  require('@hyperledger/aries-askar-nodejs')
} catch (error) {
  throw new Error('Could not load aries-askar bindings')
}
