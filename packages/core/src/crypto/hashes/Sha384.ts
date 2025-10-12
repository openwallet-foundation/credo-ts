import type { AnyUint8Array, Uint8ArrayBuffer } from '../../types'
import type { IHash } from './IHash'

import { sha384 } from '@noble/hashes/sha2.js'

export class Sha384 implements IHash {
  public hash(data: AnyUint8Array): Uint8ArrayBuffer {
    return sha384(data) as Uint8ArrayBuffer
  }
}
