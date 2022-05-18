/*
 * The replacer parameter allows you to specify a function that replaces values with your own. We can use it to control what gets stringified.
 */
export function replaceError(_: unknown, value: unknown) {
  if (value instanceof Error) {
    const newValue = Object.getOwnPropertyNames(value).reduce(
      (obj, propName) => {
        obj[propName] = (value as unknown as Record<string, unknown>)[propName]
        return obj
      },
      { name: value.name } as Record<string, unknown>
    )
    return newValue
  }

  return value
}
