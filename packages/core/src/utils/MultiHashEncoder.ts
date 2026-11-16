import type { HashName } from '../crypto/hashes'
import { Hasher } from '../crypto/hashes/Hasher'
import { CredoError } from '../error'
import { TypedArrayEncoder } from './TypedArrayEncoder'
import { VarintEncoder } from './VarintEncoder'

type MultiHashName = Exclude<HashName, 'sha-1'>

type MultiHashCodeMap = {
  [key: number]: MultiHashName | undefined
}

const multiHashNameMap: Record<MultiHashName, number> = {
  'sha-256': 0x12,
  'sha-512': 0x13,
  'sha-384': 0x20,
}

const hashExpectedDigestLength: Record<MultiHashName, number> = {
  'sha-256': 32,
  'sha-384': 48,
  'sha-512': 64,
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
    if (hashName === 'sha-1') {
      throw new CredoError(`Unsupported hash algorithm '${hashName}'`)
    }

    const hashCode = multiHashNameMap[hashName]
    if (hashCode === undefined) {
      throw new CredoError(`Unsupported hash algorithm '${hashName}'`)
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
      throw new CredoError(`Unsupported hash code 0x${hashPrefix.toString(16)}`)
    }

    if (digestLength !== withoutLengthPrefix.length) {
      throw new CredoError('Multihash digest length prefix does not match digest length')
    }

    const expectedDigestLength = hashExpectedDigestLength[hashName]
    if (digestLength !== expectedDigestLength) {
      throw new CredoError(`Invalid digest length for hash algorithm '${hashName}'`)
    }

    return {
      data: new Uint8Array(withoutLengthPrefix),
      hashName,
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
