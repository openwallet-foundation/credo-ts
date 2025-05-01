import { CredoError } from '../../error'
import { TypedArrayEncoder, isDid } from '../../utils'
import { Ed25519PublicJwk, PublicJwk, X25519PublicJwk, assymetricPublicJwkMatches } from '../kms'
import { DidDocument, VerificationMethod, convertPublicKeyToX25519, getPublicJwkFromVerificationMethod } from './domain'

import { DidKey } from './methods/key'

export function isDidKey(key: string) {
  return isDid(key, 'key')
}

export function didKeyToVerkey(key: string) {
  if (isDidKey(key)) {
    const publicKey = DidKey.fromDid(key).publicJwk.publicKey
    if (publicKey.kty !== 'OKP' || publicKey.crv !== 'Ed25519') {
      throw new CredoError('Expected OKP key with crv Ed25519')
    }

    const publicKeyBase58 = TypedArrayEncoder.toBase58(publicKey.publicKey)
    return publicKeyBase58
  }

  return key
}

export function verkeyToDidKey(verkey: string) {
  if (isDidKey(verkey)) return verkey

  const ed25519Key = verkeyToPublicJwk(verkey)
  const didKey = new DidKey(ed25519Key)
  return didKey.did
}

export function didKeyToEd25519PublicJwk(key: string) {
  const didKey = DidKey.fromDid(key)
  if (didKey.publicJwk.jwk instanceof Ed25519PublicJwk) {
    return didKey.publicJwk as PublicJwk<Ed25519PublicJwk>
  }

  throw new CredoError(
    `Expected public jwk to have kty OKP with crv Ed25519, found ${didKey.publicJwk.jwkTypehumanDescription}`
  )
}

export function verkeyToPublicJwk(verkey: string) {
  const ed25519Key = PublicJwk.fromPublicKey({
    kty: 'OKP',
    crv: 'Ed25519',
    publicKey: TypedArrayEncoder.fromBase58(verkey),
  }) as PublicJwk<Ed25519PublicJwk>
  return ed25519Key
}

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

      const keyX25519 = PublicJwk.fromPublicKey({
        crv: 'X25519',
        kty: 'OKP',
        publicKey: convertPublicKeyToX25519(v.publicJwk.publicKey.publicKey),
      })
      return assymetricPublicJwkMatches(keyX25519.toJson(), x25519Key.toJson())
    })
}
