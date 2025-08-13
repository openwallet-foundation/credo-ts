import type { IHash } from './IHash'

import { sha1 } from '@noble/hashes/legacy'

export class Sha1 implements IHash {
  public hash(data: Uint8Array | string): Uint8Array {
    return sha1(data)
  }
}
