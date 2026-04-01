import { sha512 } from '@noble/hashes/sha2.js'
import type { IHash } from './IHash'

export class Sha512 implements IHash {
  public hash(data: Uint8Array): Uint8Array {
    return sha512(data)
  }
}
