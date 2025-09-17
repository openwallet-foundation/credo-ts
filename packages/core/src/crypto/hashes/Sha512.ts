import type { IHash } from './IHash'

import { sha512 } from '@noble/hashes/sha2'

export class Sha512 implements IHash {
  public hash(data: Uint8Array | string): Uint8Array {
    return sha512(data)
  }
}
