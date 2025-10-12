import type { AnyUint8Array } from '../types'
import { decodeFromBase58, encodeToBase58 } from './base58'
import { base64ToBase64URL } from './base64'
import { Buffer } from './buffer'

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class TypedArrayEncoder {
  /**
   * Encode buffer into base64 string.
   *
   * @param buffer the buffer to encode into base64 string
   */
  public static toBase64(buffer: Buffer | AnyUint8Array) {
    return Buffer.from(buffer).toString('base64')
  }

  /**
   * Encode buffer into base64url string.
   *
   * @param buffer the buffer to encode into base64url string
   */
  public static toBase64URL(buffer: Buffer | AnyUint8Array) {
    return base64ToBase64URL(TypedArrayEncoder.toBase64(buffer))
  }

  /**
   * Encode buffer into base58 string.
   *
   * @param buffer the buffer to encode into base58 string
   */
  public static toBase58(buffer: Buffer | AnyUint8Array) {
    return encodeToBase58(buffer)
  }

  /**
   * Decode base64 string into buffer. Also supports base64url
   *
   * @param base64 the base64 or base64url string to decode into buffer format
   */
  public static fromBase64(base64: string) {
    return Buffer.from(base64, 'base64')
  }

  /**
   * Decode base58 string into buffer
   *
   * @param base58 the base58 string to decode into buffer format
   */
  public static fromBase58(base58: string) {
    return Buffer.from(decodeFromBase58(base58))
  }

  /**
   * Encode buffer into base64 string.
   *
   * @param buffer the buffer to encode into base64 string
   */
  public static toHex(buffer: Buffer | AnyUint8Array) {
    return Buffer.from(buffer).toString('hex')
  }

  /**
   * Decode hex string into buffer
   *
   * @param hex the hex string to decode into buffer format
   */
  public static fromHex(hex: string) {
    return Buffer.from(hex, 'hex')
  }

  /**
   * Decode string into buffer.
   *
   * @param str the string to decode into buffer format
   */
  public static fromString(str: string): Buffer {
    return Buffer.from(str)
  }

  public static toUtf8String(buffer: Buffer | AnyUint8Array) {
    return Buffer.from(buffer).toString()
  }

  /**
   * Check whether an array is byte, or typed, array
   *
   * @param array unknown The array that has to be checked
   *
   * @returns A boolean if the array is a byte array
   */
  public static isTypedArray(array: unknown): boolean {
    // Checks whether the static property 'BYTES_PER_ELEMENT' exists on the provided array.
    // This has to be done, since the TypedArrays, e.g. Uint8Array and Float32Array, do not
    // extend a single base class
    return 'BYTES_PER_ELEMENT' in (array as Record<string, unknown>)
  }
}
