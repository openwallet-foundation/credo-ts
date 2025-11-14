/*
 * The replacer parameter allows you to specify a function that replaces values with your own. We can use it to control what gets stringified.
 */
export function replaceError(_: unknown, value: unknown) {
  /**
   * This special handling for error classes is mostly to not hide error messages in React Native.
   * The error serialization works differently from node, so a lot of times you get `error: {}`, which
   * really compliactes debugging.
   */
  if (value instanceof Error) {
    return {
      serialized: 'toJSON' in value && typeof value.toJSON === 'function' ? value.toJSON() : value.toString(),
      message: value.message,
      name: value.name,
      stack: value.stack,
    }
  }

  return value
}
