import { sha1 } from '@noble/hashes/legacy.js'
import type { Uint8ArrayBuffer } from '../../types'
import type { IHash } from './IHash'

export class Sha1 implements IHash {
  public hash(data: Uint8ArrayBuffer): Uint8ArrayBuffer {
    return sha1(data) as Uint8ArrayBuffer
  }
}
