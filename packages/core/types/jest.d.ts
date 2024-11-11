import type { ConnectionRecord } from '../src/modules/didcomm/repository/connections/ConnectionRecord'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeConnectedWith(connection: ConnectionRecord): R
    }
  }
}
