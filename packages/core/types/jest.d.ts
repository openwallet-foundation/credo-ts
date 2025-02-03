// eslint-disable-next-line workspaces/require-dependency, workspaces/no-relative-imports
import type { ConnectionRecord } from '../../didcomm/src'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeConnectedWith(connection: ConnectionRecord): R
    }
  }
}
