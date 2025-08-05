import { Ed25519PublicJwk, PublicJwk, X25519PublicJwk, assymetricPublicJwkMatches } from '../kms'
import { DidDocument } from './domain/DidDocument'
import { getPublicJwkFromVerificationMethod } from './domain/key-type/keyDidMapping'
import { VerificationMethod } from './domain/verificationMethod'

/**
 * Tries to find a matching Ed25519 key to the supplied X25519 key
 * @param x25519Key X25519 key
 * @param didDocument Did document containing all the keys
 * @returns a matching Ed25519 key or `undefined` (if no matching key found)
 */
export function findMatchingEd25519Key(
  x25519Key: PublicJwk<X25519PublicJwk>,
  didDocument: DidDocument
): { publicJwk: PublicJwk<Ed25519PublicJwk>; verificationMethod: VerificationMethod } | undefined {
  const verificationMethods = didDocument.verificationMethod ?? []
  const keyAgreements = didDocument.keyAgreement ?? []
  const authentications = didDocument.authentication ?? []
  const allKeyReferences: VerificationMethod[] = [
    ...verificationMethods,
    ...authentications.filter((keyAgreement): keyAgreement is VerificationMethod => typeof keyAgreement !== 'string'),
    ...keyAgreements.filter((keyAgreement): keyAgreement is VerificationMethod => typeof keyAgreement !== 'string'),
  ]

  return allKeyReferences
    .map((keyReference) => {
      const verificationMethod = didDocument.dereferenceKey(keyReference.id)
      return {
        publicJwk: getPublicJwkFromVerificationMethod(verificationMethod),
        verificationMethod,
      }
    })

    .find((v): v is typeof v & { publicJwk: PublicJwk<Ed25519PublicJwk> } => {
      if (!v.publicJwk.is(Ed25519PublicJwk)) return false

      const keyX25519 = v.publicJwk.convertTo(X25519PublicJwk)
      return assymetricPublicJwkMatches(keyX25519.toJson(), x25519Key.toJson())
    })
}
