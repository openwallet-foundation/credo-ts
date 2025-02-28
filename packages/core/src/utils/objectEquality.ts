// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function areObjectsEqual<A = any, B extends A = A>(a: A, b: B): boolean {
  if (typeof a === 'object' && a != null && typeof b === 'object' && b != null) {
    const definedA = Object.fromEntries(Object.entries(a).filter(([, value]) => value !== undefined))
    const definedB = Object.fromEntries(Object.entries(b).filter(([, value]) => value !== undefined))
    if (Object.keys(definedA).length !== Object.keys(definedB).length) return false
    for (const key in definedA) {
      if (!(key in definedB) || !areObjectsEqual(definedA[key], definedB[key])) {
        return false
      }
    }
    for (const key in definedB) {
      if (!(key in definedA) || !areObjectsEqual(definedB[key], definedA[key])) {
        return false
      }
    }
    return true
  }
  return a === b
}
