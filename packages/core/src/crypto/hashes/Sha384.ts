import { sha384 } from '@noble/hashes/sha2.js'
import type { Uint8ArrayBuffer } from '../../types'
import type { IHash } from './IHash'

export class Sha384 implements IHash {
  public hash(data: Uint8ArrayBuffer): Uint8ArrayBuffer {
    return sha384(data) as Uint8ArrayBuffer
  }
}
