import 'reflect-metadata'
import type { DidCommConnectionRecord } from '@credo-ts/didcomm'
import testLogger from '../packages/core/tests/logger'

process.on('unhandledRejection', (reason) => {
  testLogger.error('Unhandled rejection in test', {
    reason,
  })

  process.exit(1)
})

expect.extend({
  toBeConnectedWith,
})

// Custom matchers which can be used to extend Vitest matchers via extend, e. g. `expect.extend({ toBeConnectedWith })`.
function toBeConnectedWith(actual: DidCommConnectionRecord, expected: DidCommConnectionRecord) {
  actual.assertReady()
  expected.assertReady()

  const pass = actual.theirDid === expected.did
  if (pass) {
    return {
      message: () => `expected connection ${actual.theirDid} not to be connected to with ${expected.did}`,
      pass: true,
    }
  }
  return {
    message: () => `expected connection ${actual.theirDid} to be connected to with ${expected.did}`,
    pass: false,
  }
}

interface CustomMatchers<R = unknown> {
  toBeConnectedWith(connection: DidCommConnectionRecord): R
}

declare module 'vitest' {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
