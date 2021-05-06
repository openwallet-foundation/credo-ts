export function isNodeJS() {
  return typeof process !== 'undefined' && process.release.name === 'node'
}
