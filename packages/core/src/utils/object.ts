export function isObject(item: unknown): item is Record<string, unknown> {
  return item != null && typeof item === 'object' && !Array.isArray(item)
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export function mergeDeep(target: unknown, ...sources: Array<unknown>): unknown {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} })
        mergeDeep(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

/**
 * Deep copies arrays, plain objects and dates. Other values, such as class instances, are not copied.
 */
export function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(deepCopy) as T
  if (value instanceof Date) return new Date(value.getTime()) as T

  if (isObject(value)) {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return value

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepCopy(item)])) as T
  }

  return value
}
