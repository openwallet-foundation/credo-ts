// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function areObjectsEqual(a: any, b: any): boolean {
  if (typeof a == 'object' && a != null && typeof b == 'object' && b != null) {
    if (Object.keys(a).length !== Object.keys(b).length) return false
    for (const key in a) {
      if (!(key in b) || !areObjectsEqual(a[key], b[key])) {
        return false
      }
    }
    for (const key in b) {
      if (!(key in a) || !areObjectsEqual(b[key], a[key])) {
        return false
      }
    }
    return true
  } else {
    return a === b
  }
}
