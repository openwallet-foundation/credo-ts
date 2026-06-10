import { TypedArrayEncoder } from '../../../../../utils'
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
