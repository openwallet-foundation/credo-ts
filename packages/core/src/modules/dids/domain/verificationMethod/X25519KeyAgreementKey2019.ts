import { CredoError } from '../../../../error'
import { TypedArrayEncoder } from '../../../../utils'
import { PublicJwk, X25519PublicJwk } from '../../../kms'

import { VerificationMethod } from './VerificationMethod'

export const VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019 = 'X25519KeyAgreementKey2019'
type X25519KeyAgreementKey2019 = VerificationMethod & {
  type: typeof VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019
}

/**
 * Get a X25519KeyAgreementKey2019 verification method.
 */
export function getX25519KeyAgreementKey2019({
  publicJwk,
  id,
  controller,
}: { id: string; publicJwk: PublicJwk<X25519PublicJwk>; controller: string }) {
  return new VerificationMethod({
    id,
    type: VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019,
    controller,
    publicKeyBase58: TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey),
  })
}

/**
 * Check whether a verification method is a X25519KeyAgreementKey2019 verification method.
 */
export function isX25519KeyAgreementKey2019(
  verificationMethod: VerificationMethod
): verificationMethod is X25519KeyAgreementKey2019 {
  return verificationMethod.type === VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019
}

/**
 * Get a key from a X25519KeyAgreementKey2019 verification method.
 */
export function getPublicJwkFrommX25519KeyAgreementKey2019(verificationMethod: X25519KeyAgreementKey2019) {
  if (!verificationMethod.publicKeyBase58) {
    throw new CredoError('verification method is missing publicKeyBase58')
  }

  return PublicJwk.fromPublicKey({
    kty: 'OKP',
    crv: 'X25519',
    publicKey: TypedArrayEncoder.fromBase58(verificationMethod.publicKeyBase58),
  })
}
