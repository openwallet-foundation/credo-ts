import 'reflect-metadata'

import type { ConnectionRecord } from '../src/modules/connections/repository/ConnectionRecord'

jest.setTimeout(120000)
expect.extend({ toBeConnectedWith })

// Custom matchers which can be used to extend Jest matchers via extend, e. g. `expect.extend({ toBeConnectedWith })`.
function toBeConnectedWith(actual: ConnectionRecord, expected: ConnectionRecord) {
  actual.assertReady()
  expected.assertReady()

  let pass
  if (actual.did.startsWith('did:') && expected.did.startsWith('did:')) {
    // If connections contain resolvebale dids we can just compare them.
    pass = actual.theirDid === expected.did
  } else {
    pass = actual.theirDid === expected.did && actual.theirKey === expected.verkey
  }

  if (pass) {
    return {
      message: () =>
        `expected connection ${actual.did}, ${actual.verkey} not to be connected to with ${expected.did}, ${expected.verkey}`,
      pass: true,
    }
  } else {
    return {
      message: () =>
        `expected connection ${actual.did}, ${actual.verkey} to be connected to with ${expected.did}, ${expected.verkey}`,
      pass: false,
    }
  }
}
