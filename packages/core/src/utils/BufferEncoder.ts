import { decodeFromBase58, encodeToBase58 } from './base58'
import { base64ToBase64URL } from './base64'
import { Buffer } from './buffer'

export class BufferEncoder {
  /**
   * Encode buffer into base64 string.
   *
   * @param buffer the buffer to encode into base64 string
   */
  public static toBase64(buffer: Buffer | Uint8Array) {
    return Buffer.from(buffer).toString('base64')
  }

  /**
   * Encode buffer into base64url string.
   *
   * @param buffer the buffer to encode into base64url string
   */
  public static toBase64URL(buffer: Buffer) {
    return base64ToBase64URL(BufferEncoder.toBase64(buffer))
  }

  /**
   * Encode buffer into base58 string.
   *
   * @param buffer the buffer to encode into base58 string
   */
  public static toBase58(buffer: Buffer | Uint8Array) {
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
   * Decode string into buffer.
   *
   * @param str the string to decode into buffer format
   */
  public static fromString(str: string): Buffer {
    return Buffer.from(str)
  }

  public static toUtf8String(buffer: Buffer | Uint8Array) {
    return Buffer.from(buffer).toString()
  }
}
