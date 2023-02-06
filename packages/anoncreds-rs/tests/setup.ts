try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  require('@hyperledger/anoncreds-nodejs')
} catch (error) {
  throw new Error('Could not load anoncreds bindings')
}
