import 'reflect-metadata'

import type { ConnectionRecord } from '../src/modules/connections/repository/ConnectionRecord'

jest.setTimeout(120000)
expect.extend({ toBeConnectedWith })

// Custom matchers which can be used to extend Jest matchers via extend, e. g. `expect.extend({ toBeConnectedWith })`.
function toBeConnectedWith(received: ConnectionRecord, connection: ConnectionRecord) {
  received.assertReady()
  connection.assertReady()

  const pass = received.theirDid === connection.did && received.theirKey === connection.verkey
  if (pass) {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} not to be connected to with ${connection.did}, ${connection.verkey}`,
      pass: true,
    }
  } else {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} to be connected to with ${connection.did}, ${connection.verkey}`,
      pass: false,
    }
  }
}
