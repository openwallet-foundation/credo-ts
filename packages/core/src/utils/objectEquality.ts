// biome-ignore lint/suspicious/noExplicitAny: no explanation
export function areObjectsEqual<A = any, B extends A = A>(a: A, b: B): boolean {
  if (typeof a === 'object' && a != null && typeof b === 'object' && b != null) {
    if (Array.isArray(a) !== Array.isArray(b)) return false
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return false

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
