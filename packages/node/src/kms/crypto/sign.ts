import { sign as _sign, constants, createHmac, createPrivateKey, createSecretKey } from 'node:crypto'
import { promisify } from 'node:util'
import type { AnyUint8Array, CanBePromise, Uint8ArrayBuffer } from '@credo-ts/core'
import { Kms, TypedArrayEncoder } from '@credo-ts/core'

const sign = promisify(_sign)

export function performSign(
  key: Kms.KmsJwkPrivate,
  algorithm: Kms.KnownJwaSignatureAlgorithm,
  data: AnyUint8Array
): CanBePromise<Uint8ArrayBuffer> {
  const nodeAlgorithm = mapJwaSignatureAlgorithmToNode(algorithm)
  const nodeKey =
    key.kty === 'oct' ? createSecretKey(TypedArrayEncoder.fromBase64(key.k)) : createPrivateKey({ format: 'jwk', key })

  switch (key.kty) {
    case 'RSA':
    case 'OKP': {
      const nodeKeyInput = algorithm.startsWith('PS')
        ? // For RSA-PSS, we need to set padding
          {
            key: nodeKey,
            padding: constants.RSA_PKCS1_PSS_PADDING,
            saltLength: Number.parseInt(algorithm.slice(2), 10) / 8,
          }
        : nodeKey

      return sign(nodeAlgorithm, data, nodeKeyInput) as Promise<Uint8ArrayBuffer>
    }
    case 'EC': {
      // Node returns EC signatures as DER encoded, but we need raw
      return sign(nodeAlgorithm, data, nodeKey).then((derSignature) =>
        Kms.derEcSignatureToRaw(derSignature, key.crv)
      ) as Promise<Uint8ArrayBuffer>
    }
    case 'oct': {
      return createHmac(nodeAlgorithm as string, nodeKey)
        .update(data)
        .digest() as Uint8ArrayBuffer
    }
    default:
      // @ts-expect-error
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty '${key.kty}'`, 'node')
  }
}

export const nodeSupportedJwaAlgorithm = [
  'RS256',
  'PS256',
  'HS256',
  'ES256',
  'ES256K',
  'RS384',
  'PS384',
  'HS384',
  'ES384',
  'RS512',
  'PS512',
  'HS512',
  'ES512',
  'EdDSA',
] as const satisfies Kms.KnownJwaSignatureAlgorithm[]

export function mapJwaSignatureAlgorithmToNode(algorithm: Kms.KnownJwaSignatureAlgorithm) {
  switch (algorithm) {
    case 'RS256':
    case 'PS256':
    case 'HS256':
    case 'ES256':
    case 'ES256K':
      return 'sha256'
    case 'RS384':
    case 'PS384':
    case 'HS384':
    case 'ES384':
      return 'sha384'
    case 'RS512':
    case 'PS512':
    case 'HS512':
    case 'ES512':
      return 'sha512'
    // For EdDSA it's derived based on the key
    case 'EdDSA':
      return undefined
    default:
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`JWA algorithm '${algorithm}'`, 'node')
  }
}
