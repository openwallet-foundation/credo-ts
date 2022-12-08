import type { Key } from '../../../../crypto'

export interface BuildKeyId {
  (did: string, key: Key): string
}

export function keyDidBuildKeyId(did: string, key: Key) {
  return `${did}#${key.fingerprint}`
}
