import { TypedArrayEncoder } from '../../../../../utils'
import type { KmsJwkPublicOkp } from './okpJwk'

export function okpPublicJwkToPublicKey(publicJwk: KmsJwkPublicOkp): Uint8Array {
  const publicKey = Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.x))

  return publicKey
}

export function okpPublicKeyToPublicJwk<Curve extends KmsJwkPublicOkp['crv']>(publicKey: Uint8Array, crv: Curve) {
  const jwk = {
    kty: 'OKP',
    crv,
    x: TypedArrayEncoder.toBase64URL(publicKey),
  } satisfies KmsJwkPublicOkp & { crv: Curve }

  return jwk
}
