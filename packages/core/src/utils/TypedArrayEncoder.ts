import { base58, base64, base64url, hex, utf8 } from '@scure/base'
import type { Uint8ArrayBuffer } from '../types'

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class TypedArrayEncoder {
  /**
   * Encode a Uint8Array into base64 string.
   */
  public static toBase64(data: Uint8ArrayBuffer): string {
    return base64.encode(data)
  }

  /**
   * Decode a base64 string into a Uint8Array
   *
   * For backwards-compatibility it also supports base64url
   */
  public static fromBase64(str: string): Uint8ArrayBuffer {
    if (/^[A-Za-z0-9\-_]+={0,2}$/.test(str)) {
      return TypedArrayEncoder.fromBase64Url(str)
    }
    return base64.decode(str) as Uint8ArrayBuffer
  }

  /**
   * Decode a base64url string into a Uint8Array
   */
  public static fromBase64Url(str: string): Uint8ArrayBuffer {
    return base64url.decode(str) as Uint8ArrayBuffer
  }

  /**
   * @deprecated Use `toBase64Url`
   */
  public static toBase64URL(data: Uint8ArrayBuffer): string {
    return base64url.encode(data)
  }

  /**
   * Encode a Uint8Array into a base64url string
   */
  public static toBase64Url(data: Uint8ArrayBuffer): string {
    return base64url.encode(data)
  }

  /**
   * Encode a Uint8Array into a base58 string
   */
  public static toBase58(data: Uint8ArrayBuffer): string {
    return base58.encode(data)
  }

  /**
   * Decode a base58 string into Uint8Array
   */
  public static fromBase58(str: string): Uint8ArrayBuffer {
    return base58.decode(str) as Uint8ArrayBuffer
  }

  /**
   * Encode a Uint8Array into a hex string
   */
  public static toHex(data: Uint8ArrayBuffer): string {
    return hex.encode(data)
  }

  /**
   * Decode a hex string into Uint8Array
   */
  public static fromHex(str: string): Uint8ArrayBuffer {
    return hex.decode(str) as Uint8ArrayBuffer
  }

  /**
   * @deprecated Use `fromUtf8String`
   */
  public static fromString(str: string): Uint8ArrayBuffer {
    return utf8.decode(str) as Uint8ArrayBuffer
  }

  /**
   * Decode a UTF-8 string into a Uint8Array
   */
  public static fromUtf8String(str: string): Uint8ArrayBuffer {
    return utf8.decode(str) as Uint8ArrayBuffer
  }

  /**
   * Encode a Uint8Array into a UTF-8 string
   */
  public static toUtf8String(data: Uint8ArrayBuffer): string {
    return utf8.encode(data)
  }

  /**
   * Concatenate multiple Uint8Arrays
   */
  public static concat(entries: Uint8ArrayBuffer[]): Uint8ArrayBuffer {
    const result = new Uint8Array(entries.reduce((n, a) => n + a.byteLength, 0))
    let offset = 0
    for (const entry of entries) {
      result.set(entry, offset)
      offset += entry.byteLength
    }
    return result
  }

  /**
   * Compare two Uint8Arrays
   *
   * @note Is a constant-time operation
   */
  public static equals(lhs: Uint8ArrayBuffer, rhs: Uint8ArrayBuffer): boolean {
    if (lhs.byteLength !== rhs.byteLength) return false
    let diff = 0
    for (let i = 0; i < lhs.length; i++) diff |= lhs[i] ^ rhs[i]
    return diff === 0
  }

  /**
   * Check whether an array is byte, or typed, array
   */
  public static isTypedArray(array: unknown): boolean {
    // Checks whether the static property 'BYTES_PER_ELEMENT' exists on the provided array.
    // This has to be done, since the TypedArrays, e.g. Uint8Array and Float32Array, do not
    // extend a single base class
    return 'BYTES_PER_ELEMENT' in (array as Record<string, unknown>)
  }
}
