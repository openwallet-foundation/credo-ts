import { CredoError } from '../../../error'
import {
  Ed25519PublicJwk,
  getJwkHumanDescription,
  P256PublicJwk,
  P384PublicJwk,
  P521PublicJwk,
  Secp256k1PublicJwk,
  X25519PublicJwk,
} from '../../kms'
import { PublicJwk } from '../../kms/jwk/PublicJwk'
import { SECURITY_JWS_CONTEXT_URL, SECURITY_X25519_CONTEXT_URL } from '../../vc/constants'
import { ED25519_SUITE_CONTEXT_URL_2018 } from '../../vc/data-integrity/signature-suites/ed25519/constants'
import { DidDocumentBuilder } from './DidDocumentBuilder'
import { convertPublicKeyToX25519 } from './key-type/ed25519'
import { getEd25519VerificationKey2018, getJsonWebKey2020, getX25519KeyAgreementKey2019 } from './verificationMethod'
import type { VerificationMethod } from './verificationMethod/VerificationMethod'

export function getDidDocumentForPublicJwk(did: string, publicJwk: PublicJwk) {
  if (publicJwk.is(Ed25519PublicJwk)) {
    return getEd25519DidDoc(did, publicJwk as PublicJwk<Ed25519PublicJwk>)
  }
  if (publicJwk.is(X25519PublicJwk)) {
    return getX25519DidDoc(did, publicJwk as PublicJwk<X25519PublicJwk>)
  }
  if (
    publicJwk.is(P256PublicJwk) ||
    publicJwk.is(P384PublicJwk) ||
    publicJwk.is(P521PublicJwk) ||
    publicJwk.is(Secp256k1PublicJwk)
  ) {
    return getJsonWebKey2020DidDocument(did, publicJwk)
  }

  throw new CredoError(`Unsupported public key type for did document: ${getJwkHumanDescription(publicJwk.toJson())}`)
}

export function getJsonWebKey2020DidDocument(did: string, publicJwk: PublicJwk) {
  const verificationMethod = getJsonWebKey2020({ did, publicJwk })

  const didDocumentBuilder = new DidDocumentBuilder(did)
  didDocumentBuilder.addContext(SECURITY_JWS_CONTEXT_URL).addVerificationMethod(verificationMethod)

  if (
    publicJwk.supportedSignatureAlgorithms.length === 0 &&
    publicJwk.supportdEncryptionKeyAgreementAlgorithms.length === 0
  ) {
    throw new CredoError('Key must support at least signing or encrypting')
  }

  if (publicJwk.supportedSignatureAlgorithms.length > 0) {
    didDocumentBuilder
      .addAuthentication(verificationMethod.id)
      .addAssertionMethod(verificationMethod.id)
      .addCapabilityDelegation(verificationMethod.id)
      .addCapabilityInvocation(verificationMethod.id)
  }

  if (publicJwk.supportdEncryptionKeyAgreementAlgorithms.length > 0) {
    didDocumentBuilder.addKeyAgreement(verificationMethod.id)
  }

  return didDocumentBuilder.build()
}

function getEd25519DidDoc(did: string, publicJwk: PublicJwk<Ed25519PublicJwk>) {
  const verificationMethod = getEd25519VerificationKey2018({
    id: `${did}#${publicJwk.fingerprint}`,
    publicJwk,
    controller: did,
  })

  const publicKeyX25519 = convertPublicKeyToX25519(publicJwk.publicKey.publicKey)

  const publicJwkX25519 = PublicJwk.fromPublicKey({
    kty: 'OKP',
    crv: 'X25519',
    publicKey: publicKeyX25519,
  })

  const x25519VerificationMethod = getX25519KeyAgreementKey2019({
    id: `${did}#${publicJwkX25519.fingerprint}`,
    publicJwk: publicJwkX25519,
    controller: did,
  })

  const didDocBuilder = getSignatureKeyBase({ did, publicJwk, verificationMethod })

  didDocBuilder
    .addContext(ED25519_SUITE_CONTEXT_URL_2018)
    .addContext(SECURITY_X25519_CONTEXT_URL)
    .addKeyAgreement(x25519VerificationMethod)

  return didDocBuilder.build()
}

function getX25519DidDoc(did: string, publicJwk: PublicJwk<X25519PublicJwk>) {
  const verificationMethod = getX25519KeyAgreementKey2019({
    id: `${did}#${publicJwk.fingerprint}`,
    publicJwk,
    controller: did,
  })

  const document = new DidDocumentBuilder(did)
    .addKeyAgreement(verificationMethod)
    .addContext(SECURITY_X25519_CONTEXT_URL)
    .build()

  return document
}

function getSignatureKeyBase({
  did,
  publicJwk,
  verificationMethod,
}: {
  did: string
  publicJwk: PublicJwk
  verificationMethod: VerificationMethod
}) {
  const keyId = `${did}#${publicJwk.fingerprint}`

  return new DidDocumentBuilder(did)
    .addVerificationMethod(verificationMethod)
    .addAuthentication(keyId)
    .addAssertionMethod(keyId)
    .addCapabilityDelegation(keyId)
    .addCapabilityInvocation(keyId)
}
