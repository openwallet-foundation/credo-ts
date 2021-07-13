export function isNodeJS() {
  return typeof process !== 'undefined' && process.release && process.release.name === 'node'
}

export function isReactNative() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return typeof navigator != 'undefined' && navigator.product == 'ReactNative'
}
