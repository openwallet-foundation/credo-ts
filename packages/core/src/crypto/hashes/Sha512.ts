import { sha512 } from '@noble/hashes/sha2.js'
import type { Uint8ArrayBuffer } from '../../types'
import type { IHash } from './IHash'

export class Sha512 implements IHash {
  public hash(data: Uint8ArrayBuffer): Uint8ArrayBuffer {
    return sha512(data) as Uint8ArrayBuffer
  }
}
