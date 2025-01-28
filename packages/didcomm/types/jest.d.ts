import type { ConnectionRecord } from '../src'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeConnectedWith(connection: ConnectionRecord): R
    }
  }
}
