import base from '@multiformats/base-x'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const base58Converter = base(BASE58_ALPHABET)

export function decodeFromBase58(base58: string) {
  return base58Converter.decode(base58)
}

export function encodeToBase58(buffer: Uint8Array) {
  return base58Converter.encode(buffer)
}
