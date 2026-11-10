import { TypedArrayEncoder } from '../../../../../utils'
import { KeyManagementError } from '../../../error/KeyManagementError'
import type { KmsJwkPublicOkp } from './okpJwk'

export function okpPublicJwkToPublicKey(publicJwk: KmsJwkPublicOkp): Uint8Array {
  return TypedArrayEncoder.fromBase64Url(publicJwk.x)
}

export function okpPublicKeyToPublicJwk<Curve extends KmsJwkPublicOkp['crv']>(publicKey: Uint8Array, crv: Curve) {
  const jwk = {
    kty: 'OKP',
    crv,
    x: TypedArrayEncoder.toBase64Url(publicKey),
  } satisfies KmsJwkPublicOkp & { crv: Curve }

  return jwk
}

export function okpMulticodecToPublicJwk<Curve extends KmsJwkPublicOkp['crv']>(publicKey: Uint8Array, crv: Curve) {
  if (publicKey.length !== 32) {
    throw new KeyManagementError(
      `Invalid public key length for multicodec with crv '${crv}': expected 32 bytes, received ${publicKey.length}`
    )
  }

  return okpPublicKeyToPublicJwk(publicKey, crv)
}
