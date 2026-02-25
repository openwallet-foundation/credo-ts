import base from '@multiformats/base-x'
import type { AnyUint8Array, Uint8ArrayBuffer } from '../types'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const base58Converter = base(BASE58_ALPHABET)

export function decodeFromBase58(base58: string): Uint8ArrayBuffer {
  return base58Converter.decode(base58) as Uint8ArrayBuffer
}

export function encodeToBase58(buffer: AnyUint8Array) {
  return base58Converter.encode(buffer)
}
