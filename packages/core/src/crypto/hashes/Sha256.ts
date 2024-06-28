import type { IHash } from './IHash'

import { sha256 } from '@noble/hashes/sha256'

export class Sha256 implements IHash {
  public hash(data: Uint8Array | string): Uint8Array {
    return sha256(data)
  }
}
