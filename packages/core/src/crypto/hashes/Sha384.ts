import type { IHash } from './IHash'

import { sha384 } from '@noble/hashes/sha2.js'

export class Sha384 implements IHash {
  public hash(data: Uint8Array): Uint8Array {
    return sha384(data)
  }
}
