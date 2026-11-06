import type { HashName } from '../crypto/hashes'
import { Hasher } from '../crypto/hashes/Hasher'
import { TypedArrayEncoder } from './TypedArrayEncoder'
import { VarintEncoder } from './VarintEncoder'

type MultiHashNameMap = Partial<Record<HashName, number>>

type MultiHashCodeMap = {
  [key: number]: HashName
}

const multiHashNameMap: MultiHashNameMap = {
  'sha-256': 0x12,
  'sha-512': 0x13,
  'sha-384': 0x20,
}

const multiHashCodeMap: MultiHashCodeMap = Object.entries(multiHashNameMap).reduce(
  // biome-ignore lint/performance/noAccumulatingSpread: no explanation
  (map, [hashName, hashCode]) => ({ ...map, [hashCode]: hashName }),
  {}
)

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
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
  public static encode(data: Uint8Array, hashName: HashName): Uint8Array {
    const hashCode = multiHashNameMap[hashName]
    if (hashCode === undefined) {
      throw new Error(`Unsupported hash algorithm '${hashName}'`)
    }

    const hash = Hasher.hash(data, hashName)

    const hashPrefix = VarintEncoder.encode(hashCode)
    const hashLengthPrefix = VarintEncoder.encode(hash.length)

    return TypedArrayEncoder.concat([hashPrefix, hashLengthPrefix, hash])
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
    const [hashPrefix, hashPrefixByteLength] = VarintEncoder.decode(data)
    const withoutHashPrefix = data.slice(hashPrefixByteLength)

    const [digestLength, lengthPrefixByteLength] = VarintEncoder.decode(withoutHashPrefix)
    const withoutLengthPrefix = withoutHashPrefix.slice(lengthPrefixByteLength)

    const hashName = multiHashCodeMap[hashPrefix]

    if (!hashName) {
      throw new Error(`Unsupported hash code 0x${hashPrefix.toString(16)}`)
    }

    if (digestLength !== withoutLengthPrefix.length) {
      throw new Error('Multihash digest length prefix does not match digest length')
    }

    const expectedDigestLength =
      hashName === 'sha-256' ? 32 : hashName === 'sha-384' ? 48 : hashName === 'sha-512' ? 64 : undefined
    if (expectedDigestLength === undefined || digestLength !== expectedDigestLength) {
      throw new Error(`Invalid digest length for hash algorithm '${hashName}'`)
    }

    return {
      data: new Uint8Array(withoutLengthPrefix),
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
    } catch (_e) {
      return false
    }
  }
}
