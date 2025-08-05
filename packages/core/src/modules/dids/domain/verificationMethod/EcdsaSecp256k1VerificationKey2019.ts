import { CredoError } from '../../../../error'
import { TypedArrayEncoder } from '../../../../utils'
import { PublicJwk, Secp256k1PublicJwk } from '../../../kms'

import { VerificationMethod } from './VerificationMethod'

export const VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019 = 'EcdsaSecp256k1VerificationKey2019'

type EcdsaSecp256k1VerificationKey2019 = VerificationMethod & {
  type: typeof VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019
}

/**
 * Get a EcdsaSecp256k1VerificationKey2019 verification method.
 */
export function getEcdsaSecp256k1VerificationKey2019({
  publicJwk,
  id,
  controller,
}: {
  id: string
  publicJwk: PublicJwk<Secp256k1PublicJwk>
  controller: string
}) {
  return new VerificationMethod({
    id,
    type: VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
    controller,
    publicKeyBase58: TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey),
  })
}

/**
 * Check whether a verification method is a EcdsaSecp256k1VerificationKey2019 verification method.
 */
export function isEcdsaSecp256k1VerificationKey2019(
  verificationMethod: VerificationMethod
): verificationMethod is EcdsaSecp256k1VerificationKey2019 {
  return verificationMethod.type === VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019
}

/**
 * Get a public jwk from a EcdsaSecp256k1VerificationKey2019 verification method.
 */
export function getPublicJwkFromEcdsaSecp256k1VerificationKey2019(
  verificationMethod: EcdsaSecp256k1VerificationKey2019
) {
  if (!verificationMethod.publicKeyBase58) {
    throw new CredoError('verification method is missing publicKeyBase58')
  }

  return PublicJwk.fromPublicKey({
    kty: 'EC',
    crv: 'secp256k1',
    publicKey: TypedArrayEncoder.fromBase58(verificationMethod.publicKeyBase58),
  })
}
