// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ConnectionRecord } from '../src/modules/connections/repository/ConnectionRecord'

declare global {
  namespace jest {
    interface Matchers<R, T> {
      toBeConnectedWith(connection: ConnectionRecord): R
    }
  }
}
