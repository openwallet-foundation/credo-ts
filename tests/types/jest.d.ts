import type { ConnectionRecord } from '@aries-framework/core'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeConnectedWith(connection: ConnectionRecord): R
    }
  }
}
