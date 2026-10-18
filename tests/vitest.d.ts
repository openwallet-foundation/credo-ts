import type { DidCommConnectionRecord } from '@credo-ts/didcomm'

interface CustomMatchers<R = unknown> {
  toBeConnectedWith(connection: DidCommConnectionRecord): R
}

declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> extends CustomMatchers<R> {}
}
