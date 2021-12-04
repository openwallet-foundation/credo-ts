import * as multihash from 'multihashes'

export class MultiHashEncoder {
  /**
   *
   * Encodes a buffer into a hash
   *
   * @param buffer the buffer that has to be encoded
   * @param hashName the hashing algorithm, 'sha2-256'
   *
   * @returns a multihash
   */
  public static encode(buffer: Uint8Array, hashName: 'sha2-256'): Uint8Array {
    return multihash.encode(buffer, hashName)
  }

  /**
   *
   * Decodes the multihash
   *
   * @param data the multihash that has to be decoded
   *
   * @returns object with the data and the hashing algorithm
   */
  public static decode(data: Uint8Array): { data: Uint8Array; hashName: string } {
    if (this.isValid(data)) {
      const decodedHash = multihash.decode(data)
      return { data: decodedHash.digest, hashName: decodedHash.name }
    }
    throw new Error(`Invalid multihash: ${data.toString()}`)
  }

  /**
   *
   * Validates if it is a valid mulithash
   *
   * @param data the multihash that needs to be validated
   *
   * @returns a boolean whether the multihash is valid
   */
  public static isValid(data: Uint8Array): boolean {
    try {
      multihash.validate(data)
      return true
    } catch (e) {
      return false
    }
  }
}
