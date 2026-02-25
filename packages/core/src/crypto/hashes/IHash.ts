import type { Uint8ArrayBuffer } from '../../types'

export interface IHash {
  hash(data: Uint8ArrayBuffer): Uint8ArrayBuffer
}
