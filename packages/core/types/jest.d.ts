import type { DidCommConnectionRecord } from '../../didcomm/src'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeConnectedWith(connection: DidCommConnectionRecord): R
    }
  }
}
