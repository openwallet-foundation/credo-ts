import type { DidCommConnectionRecord } from '../src'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeConnectedWith(connection: DidCommConnectionRecord): R
    }
  }
}
