import type { HashName } from '../crypto/hashes'

import { Hasher } from '../crypto/hashes'

import { VarintEncoder } from './VarintEncoder'
import { Buffer } from './buffer'

type MultiHashNameMap = {
  [key in HashName]: number
}

type MultiHashCodeMap = {
  [key: number]: HashName
}

const multiHashNameMap: MultiHashNameMap = {
  'sha-1': 0x11,
  'sha-256': 0x12,
}

const multiHashCodeMap: MultiHashCodeMap = Object.entries(multiHashNameMap).reduce(
  (map, [hashName, hashCode]) => ({ ...map, [hashCode]: hashName }),
  {}
)

export class MultiHashEncoder {
  /**
   *
   * Encodes a buffer into a hash
   *
   * @param buffer the buffer that has to be encoded
   * @param hashName the hashing algorithm, 'sha-256'
   *
   * @returns a multihash
   */
  public static encode(data: Uint8Array, hashName: HashName): Buffer {
    const hash = Hasher.hash(data, hashName)
    const hashCode = multiHashNameMap[hashName]

    const hashPrefix = VarintEncoder.encode(hashCode)
    const hashLengthPrefix = VarintEncoder.encode(hash.length)

    return Buffer.concat([hashPrefix, hashLengthPrefix, hash])
  }

  /**
   *
   * Decodes the multihash
   *
   * @param data the multihash that has to be decoded
   *
   * @returns object with the data and the hashing algorithm
   */
  public static decode(data: Uint8Array): { data: Buffer; hashName: string } {
    const [hashPrefix, hashPrefixByteLength] = VarintEncoder.decode(data)
    const withoutHashPrefix = data.slice(hashPrefixByteLength)

    const [, lengthPrefixByteLength] = VarintEncoder.decode(withoutHashPrefix)
    const withoutLengthPrefix = withoutHashPrefix.slice(lengthPrefixByteLength)

    const hashName = multiHashCodeMap[hashPrefix]

    if (!hashName) {
      throw new Error(`Unsupported hash code 0x${hashPrefix.toString(16)}`)
    }

    return {
      data: Buffer.from(withoutLengthPrefix),
      hashName: multiHashCodeMap[hashPrefix],
    }
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
      MultiHashEncoder.decode(data)
      return true
    } catch (e) {
      return false
    }
  }
}
