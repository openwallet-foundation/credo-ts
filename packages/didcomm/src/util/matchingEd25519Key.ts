import { DidDocument, Kms, VerificationMethod } from '@credo-ts/core'

import { convertPublicKeyToX25519, getPublicJwkFromVerificationMethod } from '@credo-ts/core'

/**
 * Tries to find a matching Ed25519 key to the supplied X25519 key
 * @param x25519Key X25519 key
 * @param didDocument Did document containing all the keys
 * @returns a matching Ed25519 key or `undefined` (if no matching key found)
 */
export function findMatchingEd25519Key(
  x25519Key: Kms.PublicJwk<Kms.X25519PublicJwk>,
  didDocument: DidDocument
): Kms.PublicJwk<Kms.Ed25519PublicJwk> | undefined {
  const verificationMethods = didDocument.verificationMethod ?? []
  const keyAgreements = didDocument.keyAgreement ?? []
  const authentications = didDocument.authentication ?? []
  const allKeyReferences: VerificationMethod[] = [
    ...verificationMethods,
    ...authentications.filter((keyAgreement): keyAgreement is VerificationMethod => typeof keyAgreement !== 'string'),
    ...keyAgreements.filter((keyAgreement): keyAgreement is VerificationMethod => typeof keyAgreement !== 'string'),
  ]

  return allKeyReferences
    .map((keyReference) => getPublicJwkFromVerificationMethod(didDocument.dereferenceKey(keyReference.id)))
    .filter((publicJwk) => publicJwk.is(Kms.Ed25519PublicJwk))
    .find((keyEd25519) => {
      const keyX25519 = Kms.PublicJwk.fromPublicKey({
        crv: 'X25519',
        kty: 'OKP',
        publicKey: convertPublicKeyToX25519(keyEd25519.publicKey.publicKey),
      })
      return Kms.assymetricPublicJwkMatches(keyX25519.toJson(), x25519Key.toJson())
    })
}
