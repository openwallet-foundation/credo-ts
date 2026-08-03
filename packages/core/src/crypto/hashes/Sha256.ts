import { sha256 } from '@noble/hashes/sha2.js'
import type { IHash } from './IHash'

export class Sha256 implements IHash {
  public hash(data: Uint8Array): Uint8Array {
    return sha256(data) as Uint8Array
  }
}
