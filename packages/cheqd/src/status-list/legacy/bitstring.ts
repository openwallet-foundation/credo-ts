import { CredoError, TypedArrayEncoder } from '@credo-ts/core'
import { gzip, ungzip } from 'pako'

import { decodeBase64OrBase64Url } from '../../dids/didCheqdUtil'

/** An all-zero list with `entries` entries of `statusSize` bits each */
export function createBitstring(entries: number, statusSize = 1): Uint8Array {
  if (!Number.isInteger(entries) || entries <= 0) throw new CredoError('The length of a status list must be positive')
  if (!Number.isInteger(statusSize) || statusSize <= 0) throw new CredoError('The status size must be positive')
  return new Uint8Array(Math.ceil((entries * statusSize) / 8))
}

/** gzip, then base64url: the form of `encodedList` in the status list resources already written to the network */
export function encodeBitstring(bits: Uint8Array): string {
  return TypedArrayEncoder.toBase64Url(gzip(bits))
}

/** The inverse of {@link encodeBitstring}. A multibase `u` prefix (W3C Bitstring Status List) and standard base64 are accepted. */
export function decodeBitstring(encodedList: string): Uint8Array {
  // A gzip stream starts with 0x1f8b, which is `H4s` in base64, so a leading `u` is always the multibase prefix
  const value = encodedList.startsWith('u') ? encodedList.slice(1) : encodedList
  try {
    return ungzip(decodeBase64OrBase64Url(value))
  } catch (error) {
    throw new CredoError(`The encodedList of the status list is not a gzip compressed bitstring: ${error}`)
  }
}

function assertInRange(bits: Uint8Array, index: number, statusSize: number) {
  if (!Number.isInteger(index) || index < 0) throw new CredoError(`Invalid status list index ${index}`)
  if ((index + 1) * statusSize > bits.length * 8) {
    throw new CredoError(
      `Status list index ${index} is out of range for a list of ${(bits.length * 8) / statusSize} entries`
    )
  }
}

/**
 * The value of the entry at `index`. Entries are laid out left to right, so entry 0 starts at the top bit of the first
 * byte. Within an entry of several bits the first bit is the least significant, as in the lists Veramo wrote: a 2 bit
 * entry whose bits read `1 0` is the value 1.
 */
export function getBitstringStatus(bits: Uint8Array, index: number, statusSize = 1): number {
  assertInRange(bits, index, statusSize)
  let value = 0
  for (let i = 0; i < statusSize; i++) {
    const position = index * statusSize + i
    value |= ((bits[position >> 3] >> (7 - (position & 7))) & 1) << i
  }
  return value
}

/** Sets the value of the entry at `index`, in place */
export function setBitstringStatus(bits: Uint8Array, index: number, statusSize: number, value: number): void {
  assertInRange(bits, index, statusSize)
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** statusSize) {
    throw new CredoError(`The value ${value} does not fit in ${statusSize} bit(s)`)
  }
  for (let i = 0; i < statusSize; i++) {
    const position = index * statusSize + i
    const bit = (value >> i) & 1
    const mask = 1 << (7 - (position & 7))
    bits[position >> 3] = bit ? bits[position >> 3] | mask : bits[position >> 3] & ~mask
  }
}
