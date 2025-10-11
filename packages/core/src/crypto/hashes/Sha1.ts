import type { IHash } from './IHash'

import { sha1 } from '@noble/hashes/legacy.js'

export class Sha1 implements IHash {
  public hash(data: Uint8Array): Uint8Array {
    return sha1(data)
  }
}
