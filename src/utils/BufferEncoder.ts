import { base64ToBase64URL } from './base64'
import { Buffer } from './buffer'

export class BufferEncoder {
  /**
   * Encode buffer into base64 string.
   *
   * @param buffer the buffer to encode into base64 string
   */
  public static toBase64(buffer: Buffer) {
    return buffer.toString('base64')
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
   * Decode base64 string into buffer. Also supports base64url
   *
   * @param base64 the base64 or base64url string to decode into buffer format
   */
  public static fromBase64(base64: string) {
    return Buffer.from(base64, 'base64')
  }
}
