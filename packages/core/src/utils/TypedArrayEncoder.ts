import { base58, base64, base64url, hex, utf8 } from '@scure/base'
import { CredoError } from '../error'

const MAX_BASE58_MANUAL_ENCODING_BYTES = 2594

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class TypedArrayEncoder {
  /**
   * Encode a Uint8Array into base64 string
   */
  public static toBase64(data: Uint8Array) {
    try {
      return base64.encode(data)
    } catch (error) {
      throw new CredoError(`Could not encode data to base64 string`, { cause: error })
    }
  }

  /**
   * Decode a base64 string into a Uint8Array
   */
  public static fromBase64(data: string) {
    try {
      return base64.decode(data)
    } catch (error) {
      throw new CredoError(`Could not decode data from base64 string`, { cause: error })
    }
  }

  /**
   * Encode a Uint8Array into a base64url string
   *
   * It will encode the data following the base64url without padding standard
   */
  public static toBase64Url(data: Uint8Array) {
    try {
      // scure only uses the native Uint8Array base64 methods for the padded coder
      return base64url.encode(data).replace(/=+$/, '')
    } catch (error) {
      throw new CredoError(`Could not encode data to base64url string`, { cause: error })
    }
  }

  /**
   * Decode a Uint8Array into a base64url string
   *
   * It will decode the data following the base64url without padding standard
   */
  public static fromBase64Url(data: string) {
    try {
      if (data.includes('=')) throw new Error('Unexpected padding in base64url string')
      return base64url.decode(data + '==='.slice((data.length + 3) % 4))
    } catch (error) {
      throw new CredoError(`Could not decode data from base64url string`, { cause: error })
    }
  }

  /**
   * Encode a Uint8Array into base58 string
   */
  public static toBase58(data: Uint8Array) {
    try {
      if (data.length <= 2048) return base58.encode(data)
      if (data.length > MAX_BASE58_MANUAL_ENCODING_BYTES) {
        throw new Error(`Input exceeds maximum Base58 encoding length of ${MAX_BASE58_MANUAL_ENCODING_BYTES} bytes`)
      }

      const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
      let value = 0n
      for (const byte of data) value = (value << 8n) | BigInt(byte)

      let encoded = ''
      while (value > 0n) {
        const remainder = Number(value % 58n)
        encoded = alphabet[remainder] + encoded
        value /= 58n
      }

      let leadingZeroBytes = 0
      while (leadingZeroBytes < data.length && data[leadingZeroBytes] === 0) leadingZeroBytes++

      return `${'1'.repeat(leadingZeroBytes)}${encoded}`
    } catch (error) {
      throw new CredoError(`Could not encode data to base58 string`, { cause: error })
    }
  }

  /**
   * Decode a base58 string into a Uint8Array
   */
  public static fromBase58(data: string) {
    try {
      return base58.decode(data)
    } catch (error) {
      throw new CredoError(`Could not decode data from base58 string`, { cause: error })
    }
  }

  /**
   * Encode a Uint8Array into a hex string
   */
  public static toHex(data: Uint8Array) {
    try {
      return hex.encode(data)
    } catch (error) {
      throw new CredoError(`Could not encode data to hex string`, { cause: error })
    }
  }

  /**
   * Decode a hex string into a Uint8Array
   */
  public static fromHex(data: string) {
    try {
      return hex.decode(data)
    } catch (error) {
      throw new CredoError(`Could not decode data from hex string`, { cause: error })
    }
  }

  /**
   * Decode a UTF-8 string into a Uint8Array
   */
  public static fromUtf8String(data: string) {
    try {
      return utf8.decode(data)
    } catch (error) {
      throw new CredoError(`Could not decode data from utf8 string`, { cause: error })
    }
  }

  /**
   * Encode a Uint8Array into a UTF-8 string
   */
  public static toUtf8String(data: Uint8Array) {
    try {
      return utf8.encode(data)
    } catch (error) {
      throw new CredoError(`Could not encode data to utf8 string`, { cause: error })
    }
  }

  /**
   * Concatenate multiple Uint8Arrays
   */
  public static concat(entries: Uint8Array[]): Uint8Array {
    try {
      const result = new Uint8Array(entries.reduce((n, a) => n + a.byteLength, 0))
      let offset = 0
      for (const entry of entries) {
        result.set(entry, offset)
        offset += entry.byteLength
      }
      return result
    } catch (error) {
      throw new CredoError(`Could not concatenate Uint8Arrays`, { cause: error })
    }
  }

  /**
   * Compare two Uint8Arrays
   *
   * @note Is a constant-time operation
   */
  public static equals(lhs: Uint8Array, rhs: Uint8Array): boolean {
    try {
      if (lhs.byteLength !== rhs.byteLength) return false
      let diff = 0
      for (let i = 0; i < lhs.length; i++) diff |= lhs[i] ^ rhs[i]
      return diff === 0
    } catch (error) {
      throw new CredoError(`Could not compare Uint8Arrays`, { cause: error })
    }
  }

  /**
   * Check whether an array is byte, or typed, array
   *
   * @param array unknown The array that has to be checked
   *
   * @returns A boolean if the array is a byte array
   */
  public static isTypedArray(array: unknown): boolean {
    try {
      return 'BYTES_PER_ELEMENT' in (array as Record<string, unknown>)
    } catch (error) {
      throw new CredoError(`Could not check if array is typed array`, { cause: error })
    }
  }
}
