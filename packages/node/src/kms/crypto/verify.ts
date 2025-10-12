import { type AnyUint8Array, type CanBePromise, Kms } from '@credo-ts/core'

import { Buffer } from 'node:buffer'
import {
  constants,
  verify as _verify,
  createHmac,
  createPublicKey,
  createSecretKey,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'
import { TypedArrayEncoder } from '@credo-ts/core'

import { mapJwaSignatureAlgorithmToNode } from './sign'

const verify = promisify(_verify)

export function performVerify(
  key: Kms.KmsJwkPrivate | Kms.KmsJwkPublicEc | Kms.KmsJwkPublicOkp | Kms.KmsJwkPublicRsa,
  algorithm: Kms.KnownJwaSignatureAlgorithm,
  data: AnyUint8Array,
  signature: AnyUint8Array
): CanBePromise<boolean> {
  const nodeAlgorithm = mapJwaSignatureAlgorithmToNode(algorithm)
  const nodeKey =
    key.kty === 'oct' ? createSecretKey(TypedArrayEncoder.fromBase64(key.k)) : createPublicKey({ format: 'jwk', key })

  switch (key.kty) {
    case 'RSA':
    case 'OKP': {
      const nodeKeyInput = algorithm.startsWith('PS')
        ? // For RSA-PSS, we need to set padding
          {
            key: nodeKey,
            padding: constants.RSA_PKCS1_PSS_PADDING,
            saltLength: Number.parseInt(algorithm.slice(2)) / 8,
          }
        : nodeKey

      return verify(nodeAlgorithm, data, nodeKeyInput, signature)
    }
    case 'EC': {
      // Node expects DER encoded signature, but we input raw
      return verify(nodeAlgorithm, data, nodeKey, Kms.rawEcSignatureToDer(signature, key.crv))
    }
    case 'oct': {
      const expectedHmac = createHmac(nodeAlgorithm as string, nodeKey)
        .update(data)
        .digest()

      return timingSafeEqual(expectedHmac, Buffer.from(signature))
    }
    default:
      // @ts-expect-error
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty '${key.kty}'`, 'node')
  }
}
