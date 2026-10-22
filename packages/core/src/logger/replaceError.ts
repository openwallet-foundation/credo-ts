/*
 * The replacer parameter allows you to specify a function that replaces values with your own. We can use it to control what gets stringified.
 */
export function replaceError(_: unknown, value: unknown) {
  /**
   * This special handling for error classes is mostly to not hide error messages in React Native.
   * The error serialization works differently from node, so a lot of times you get `error: {}`, which
   * really compliactes debugging.
   *
   * `cause` is non-enumerable on both CredoError and the built-in Error class, so JSON.stringify skips
   * it. We walk the cause chain ourselves, using a local Set to detect cycles instead of relying on
   * JSON.stringify's built-in ancestor check (which wouldn't catch cycles across the new plain objects
   * we return for each error).
   */
  if (!(value instanceof Error)) return value

  const seen = new Set<Error>()
  const serialize = (error: Error): Record<string, unknown> => {
    seen.add(error)
    return {
      serialized: 'toJSON' in error && typeof error.toJSON === 'function' ? error.toJSON() : error.toString(),
      message: error.message,
      name: error.name,
      stack: error.stack,
      ...(error.cause !== undefined && {
        cause:
          error.cause instanceof Error ? (seen.has(error.cause) ? '[Circular]' : serialize(error.cause)) : error.cause,
      }),
    }
  }

  return serialize(value)
}
