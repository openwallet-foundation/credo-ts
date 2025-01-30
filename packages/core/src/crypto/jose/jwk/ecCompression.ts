/**
 * Based on https://github.com/transmute-industries/verifiable-data/blob/main/packages/web-crypto-key-pair/src/compression/ec-compression.ts
 */

// TODO(crypto): can remove this?
// native BigInteger is only supported in React Native 0.70+, so we use big-integer for now.
import bigInt from 'big-integer'

import { Buffer } from '../../../utils/buffer'
import { KeyType } from '../../KeyType'

export type CompressableKey = KeyType.K256 | KeyType.P256 | KeyType.P384 | KeyType.P521

const curveToPointLength: Record<CompressableKey, number> = {
  [KeyType.K256]: 64,
  [KeyType.P256]: 64,
  [KeyType.P384]: 96,
  [KeyType.P521]: 132,
}

function getConstantsForCurve(curve: KeyType) {
  let two, prime, b, pIdent

  if (curve === KeyType.P256) {
    two = bigInt(2)
    prime = two.pow(256).subtract(two.pow(224)).add(two.pow(192)).add(two.pow(96)).subtract(1)

    pIdent = prime.add(1).divide(4)

    b = bigInt('5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b', 16)
  }

  if (curve === KeyType.P384) {
    two = bigInt(2)
    prime = two.pow(384).subtract(two.pow(128)).subtract(two.pow(96)).add(two.pow(32)).subtract(1)

    pIdent = prime.add(1).divide(4)
    b = bigInt('b3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef', 16)
  }

  if (curve === KeyType.P521) {
    two = bigInt(2)
    prime = two.pow(521).subtract(1)
    b = bigInt(
      '00000051953eb9618e1c9a1f929a21a0b68540eea2da725b99b315f3b8b489918ef109e156193951ec7e937b1652c0bd3bb1bf073573df883d2c34f1ef451fd46b503f00',
      16
    )
    pIdent = prime.add(1).divide(4)
  }

  // https://en.bitcoin.it/wiki/Secp256k1
  // p = FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE FFFFFC2F
  // P = 2256 - 232 - 29 - 28 - 27 - 26 - 24 - 1
  if (curve === KeyType.K256) {
    two = bigInt(2)
    prime = two
      .pow(256)
      .subtract(two.pow(32))
      .subtract(two.pow(9))
      .subtract(two.pow(8))
      .subtract(two.pow(7))
      .subtract(two.pow(6))
      .subtract(two.pow(4))
      .subtract(1)
    b = bigInt(7)
    pIdent = prime.add(1).divide(4)
  }

  if (!prime || !b || !pIdent) {
    throw new Error(`Unsupported curve ${curve}`)
  }

  return { prime, b, pIdent }
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
  const publicKeyComponent = Buffer.from(publicKey).toString('hex')
  const { prime, b, pIdent } = getConstantsForCurve(curve)
  const signY = new Number(publicKeyComponent[1]).valueOf() - 2
  const x = bigInt(publicKeyComponent.substring(2), 16)

  // y^2 = x^3 - 3x + b
  let y = x.pow(3).subtract(x.multiply(3)).add(b).modPow(pIdent, prime)

  if (curve === KeyType.K256) {
    // y^2 = x^3 + 7
    y = x.pow(3).add(7).modPow(pIdent, prime)
  }

  // If the parity doesn't match it's the *other* root
  if (y.mod(2).toJSNumber() !== signY) {
    // y = prime - y
    y = prime.subtract(y)
  }

  return Uint8Array.from([
    0x04,
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
