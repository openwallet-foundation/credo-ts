import multihash from 'multihashes'
import { Buffer } from './buffer'

export class MultihashEncoder {
  /**
   *
   * Encodes a buffer into a hash
   *
   * @param {Uint8Array} buffer the buffer that has to be encoded
   * @param {string} hashName the hashing algorithm, 'sha2-256'
   */
  public static encode(buffer: Uint8Array, hashName: 'sha2-256') {
    return multihash.encode(buffer, hashName)
  }

  /**
   *
   * Decodes the multihash
   *
   * @param {Uint8Array} data the multihash that has to be decoded
   */
  public static decode(data: Uint8Array): { data: Uint8Array; hashName: string } {
    const decodedHash = multihash.decode(data)
    return { data: decodedHash.digest, hashName: decodedHash.name }
  }

  /**
   *
   * Validates if it is a valid mulithash
   *
   * @param {Uint8Array} data the multihash that needs to be validated
   */
  public static validate(data: Uint8Array) {
    try {
      multihash.validate(data)
      return true
    } catch (e) {
      return false
    }
  }
}
