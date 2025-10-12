import type { AnyUint8Array, Uint8ArrayBuffer } from '../../types'
import type { IHash } from './IHash'

import { sha512 } from '@noble/hashes/sha2.js'

export class Sha512 implements IHash {
  public hash(data: AnyUint8Array): Uint8ArrayBuffer {
    return sha512(data) as Uint8ArrayBuffer
  }
}
