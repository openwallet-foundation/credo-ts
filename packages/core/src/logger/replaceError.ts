/*
 * The replacer parameter allows you to specify a function that replaces values with your own. We can use it to control what gets stringified.
 */
export function replaceError(_: unknown, value: unknown) {
  if (value instanceof Error) {
    return value.toString()
  }

  return value
}
