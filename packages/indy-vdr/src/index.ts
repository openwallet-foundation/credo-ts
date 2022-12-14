try {
  require('indy-vdr-test-nodejs')
} catch (error) {
  throw new Error('Error registering nodejs bindings for Indy VDR')
}
