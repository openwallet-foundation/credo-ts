import type { AnyUint8Array, Uint8ArrayBuffer } from '../../types'
import type { IHash } from './IHash'

import { sha256 } from '@noble/hashes/sha2.js'

export class Sha256 implements IHash {
  public hash(data: AnyUint8Array): Uint8ArrayBuffer {
    return sha256(data) as Uint8ArrayBuffer
  }
}
