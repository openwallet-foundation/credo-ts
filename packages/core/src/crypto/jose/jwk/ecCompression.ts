import { Buffer } from '../../../utils/buffer'
import { KeyType } from '../../KeyType'

export type CompressableKey = KeyType.K256 | KeyType.P256 | KeyType.P384 | KeyType.P521

const curveToPointLength: Record<CompressableKey, number> = {
  [KeyType.K256]: 64,
  [KeyType.P256]: 64,
  [KeyType.P384]: 96,
  [KeyType.P521]: 132,
}

/**
 *
 * Get constants for a specified curve
 *
 * pIdent = (p + 1) / 4 but precomputed for performance
 *
 */
function getConstantsForCurve(curve: KeyType) {
  let p, b, pIdent

  // https://neuromancer.sk/std/nist/P-256
  if (curve === KeyType.P256) {
    p = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn
    pIdent = 0x3fffffffc0000000400000000000000000000000400000000000000000000000n
    b = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn
  }

  // https://neuromancer.sk/std/nist/P-384
  if (curve === KeyType.P384) {
    p = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffffn
    pIdent = 0x3fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffbfffffffc00000000000000040000000n
    b = 0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aefn
  }

  // https://neuromancer.sk/std/nist/P-521
  if (curve === KeyType.P521) {
    p =
      6864797660130609714981900799081393217269435300143305409394463459185543183397656052122559640661454554977296311391480858037121987999716643812574028291115057151n
    p =
      0x01ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn
    pIdent =
      0x8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
    b =
      0x0051953eb9618e1c9a1f929a21a0b68540eea2da725b99b315f3b8b489918ef109e156193951ec7e937b1652c0bd3bb1bf073573df883d2c34f1ef451fd46b503f00n
  }

  if (curve === KeyType.K256) {
    p = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn
    pIdent = 0x3fffffffffffffffffffffffffffffffffffffffffffffffffffffffbfffff0cn
    b = 0x7n
  }

  if (!p || !b || !pIdent) {
    throw new Error(`Unsupported curve ${curve}`)
  }

  return { p, b, pIdent }
}

// see https://stackoverflow.com/questions/17171542/algorithm-for-elliptic-curve-point-compression
// https://github.com/w3c-ccg/did-method-key/pull/36
/**
 * Point compress elliptic curve key
 * @return Compressed representation
 */
export function compressECPoint(x: Uint8Array, y: Uint8Array): Uint8Array {
  const out = new Uint8Array(x.length + 1)
  out[0] = 2 + (y[y.length - 1] & 1)
  out.set(x, 1)
  return out
}

function padWithZeroes(number: number | string, length: number) {
  let value = '' + number
  while (value.length < length) {
    value = '0' + value
  }
  return value
}

export function compress(publicKey: Uint8Array): Uint8Array {
  const x = publicKey.slice(1, publicKey.length / 2 + 1)
  const y = publicKey.slice(publicKey.length / 2 + 1)
  return compressECPoint(x, y)
}

export function compressIfPossible(publicKey: Uint8Array, keyType: KeyType): Uint8Array {
  return isValidUncompressedPublicKey(publicKey, keyType) ? compress(publicKey) : publicKey
}

export function expandIfPossible(publicKey: Uint8Array, keyType: KeyType): Uint8Array {
  return isValidCompressedPublicKey(publicKey, keyType) ? expand(publicKey, keyType as CompressableKey) : publicKey
}

export function expand(publicKey: Uint8Array, curve: CompressableKey): Uint8Array {
  const { p, b, pIdent } = getConstantsForCurve(curve)

  const signY = publicKey[0]
  const x = publicKey.slice(1).reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n)

  let y = curve === KeyType.K256 ? x ** 3n + 7n : x ** 3n - x * 3n + b
  y = modPow(y, pIdent, p)

  if (signY % 2 === 1) {
    y = p - y
  }

  return Uint8Array.from([
    PREFIX_UNCOMPRESSED,
    ...Buffer.from(
      padWithZeroes(x.toString(16), curveToPointLength[curve]) +
        padWithZeroes(y.toString(16), curveToPointLength[curve]),
      'hex'
    ),
  ])
}

export const PREFIX_UNCOMPRESSED = 0x04
export const PREFIX_COMPRESSED_Y_IS_ODD = 0x03
export const PREFIX_COMPRESSED_Y_IS_EVEN = 0x02

function isCompressedKeyValidLength(length: number, keyType: KeyType) {
  switch (keyType) {
    case KeyType.K256:
    case KeyType.P256:
      return length === 33
    case KeyType.P384:
      return length === 49
    case KeyType.P521:
      return length === 67 || length === 66
    default:
      return false
  }
}

function isUncompressedKeyValidLength(length: number, keyType: KeyType) {
  switch (keyType) {
    case KeyType.K256:
    case KeyType.P256:
      return length === 65
    case KeyType.P384:
      return length === 97
    case KeyType.P521:
      return length === 133 || length === 131
    default:
      return false
  }
}

export function isValidCompressedPublicKey(publicKey: Uint8Array, keyType: KeyType) {
  return (
    isCompressedKeyValidLength(publicKey.length, keyType) &&
    (publicKey[0] === PREFIX_COMPRESSED_Y_IS_ODD || publicKey[0] === PREFIX_COMPRESSED_Y_IS_EVEN)
  )
}

export function isValidUncompressedPublicKey(publicKey: Uint8Array, keyType: KeyType) {
  return isUncompressedKeyValidLength(publicKey.length, keyType) && publicKey[0] === PREFIX_UNCOMPRESSED
}

/**
 *
 * Modular exponentiation optimalization
 *
 * Equivalent to: base ** exponent % modulus
 * However, because base ** exponent can be very large, this optimalization has to be done
 * to keep the number managable for the BigInt type in JS
 *
 */
function modPow(base: bigint, exponent: bigint, modulus: bigint) {
  if (modulus === 1n) return 0n

  let result = 1n
  base = ((base % modulus) + modulus) % modulus

  while (exponent > 0n) {
    if (exponent & 1n) {
      result = (result * base) % modulus
    }
    base = (base * base) % modulus
    exponent >>= 1n
  }
  return result
}
