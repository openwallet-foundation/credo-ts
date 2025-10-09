import type { DidCommConnectionRecord } from '@credo-ts/didcomm'

interface CustomMatchers<R = unknown> {
  toBeConnectedWith(connection: DidCommConnectionRecord): R
}

declare module 'vitest' {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
