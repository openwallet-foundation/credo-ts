export function isNodeJS() {
  return typeof process !== 'undefined' && process.release && process.release.name === 'node'
}

export function isReactNative() {
  return typeof navigator != 'undefined' && navigator.product == 'ReactNative'
}
