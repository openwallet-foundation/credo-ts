import type { Uint8ArrayBuffer } from '../../../../../types'
import { TypedArrayEncoder } from '../../../../../utils'
import type { KmsJwkPublicOkp } from './okpJwk'

export function okpPublicJwkToPublicKey(publicJwk: KmsJwkPublicOkp): Uint8ArrayBuffer {
  const publicKey = Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.x))

  return publicKey
}

export function okpPublicKeyToPublicJwk<Curve extends KmsJwkPublicOkp['crv']>(publicKey: Uint8ArrayBuffer, crv: Curve) {
  const jwk = {
    kty: 'OKP',
    crv,
    x: TypedArrayEncoder.toBase64Url(publicKey),
  } satisfies KmsJwkPublicOkp & { crv: Curve }

  return jwk
}
