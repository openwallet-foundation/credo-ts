import zlib from 'zlib'
import base64url from 'base64url'
import { Buffer } from '@credo-ts/core'

export function createEmptyBitmap(size: number): Buffer {
  const byteLength = Math.ceil(size / 8)
  return Buffer.alloc(byteLength) // All bits = 0
}

export function setBit(bitmap: Buffer, index: number): Buffer {
  const byteIndex = Math.floor(index / 8)
  const bitIndex = index % 8
  bitmap[byteIndex] |= 1 << (7 - bitIndex)
  return bitmap
}

export function isBitSet(bitmap: Buffer, index: number): boolean {
  const byteIndex = Math.floor(index / 8)
  const bitIndex = index % 8
  return (bitmap[byteIndex] & (1 << (7 - bitIndex))) !== 0
}

export function encodeBitmap(bitmap: Buffer): string {
  const compressed = zlib.deflateSync(bitmap)
  return base64url.encode(compressed)
}

export function decodeBitmap(encoded: string): Buffer {
  const compressed = base64url.toBuffer(encoded)
  return Buffer.from(zlib.inflateSync(compressed))
}
