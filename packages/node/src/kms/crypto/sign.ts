import type { CanBePromise } from '@credo-ts/core'

import { TypedArrayEncoder, Kms } from '@credo-ts/core'
import { constants, createHmac, createPrivateKey, sign as _sign, createSecretKey } from 'node:crypto'
import { promisify } from 'node:util'

const sign = promisify(_sign)

export function performSign(
  key: Kms.KmsJwkPrivate,
  algorithm: Kms.KnownJwaSignatureAlgorithm,
  data: Uint8Array
): CanBePromise<Uint8Array> {
  const nodeAlgorithm = mapJwaSignatureAlgorithmToNode(algorithm)
  const nodeKey =
    key.kty === 'oct' ? createSecretKey(TypedArrayEncoder.fromBase64(key.k)) : createPrivateKey({ format: 'jwk', key })

  switch (key.kty) {
    case 'RSA':
    case 'EC':
    case 'OKP': {
      const nodeKeyInput = algorithm.startsWith('PS')
        ? // For RSA-PSS, we need to set padding
          {
            key: nodeKey,
            padding: constants.RSA_PKCS1_PSS_PADDING,
            saltLength: parseInt(algorithm.slice(2)) / 8,
          }
        : nodeKey

      return sign(nodeAlgorithm, data, nodeKeyInput)
    }
    case 'oct': {
      return createHmac(nodeAlgorithm as string, nodeKey)
        .update(data)
        .digest()
    }
    default:
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty '${key.kty}'`, 'node')
  }
}

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
