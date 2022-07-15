import type { VerificationMethod } from './verificationMethod/VerificationMethod'

import { KeyType, Key } from '../../../crypto'
import { SECURITY_CONTEXT_BBS_URL, SECURITY_X25519_CONTEXT_URL } from '../../vc/constants'
import { ED25519_SUITE_CONTEXT_URL_2018 } from '../../vc/signature-suites/ed25519/constants'

import { DidDocumentBuilder } from './DidDocumentBuilder'
import { getBls12381g1VerificationMethod } from './key-type/bls12381g1'
import { getBls12381g1g2VerificationMethod } from './key-type/bls12381g1g2'
import { getBls12381g2VerificationMethod } from './key-type/bls12381g2'
import { convertPublicKeyToX25519, getEd25519VerificationMethod } from './key-type/ed25519'
import { getX25519VerificationMethod } from './key-type/x25519'

const didDocumentKeyTypeMapping = {
  [KeyType.Ed25519]: getEd25519DidDoc,
  [KeyType.X25519]: getX25519DidDoc,
  [KeyType.Bls12381g1]: getBls12381g1DidDoc,
  [KeyType.Bls12381g2]: getBls12381g2DidDoc,
  [KeyType.Bls12381g1g2]: getBls12381g1g2DidDoc,
}

export function getDidDocumentForKey(did: string, key: Key) {
  const getDidDocument = didDocumentKeyTypeMapping[key.keyType]

  return getDidDocument(did, key)
}

function getBls12381g1DidDoc(did: string, key: Key) {
  const verificationMethod = getBls12381g1VerificationMethod(did, key)

  return getSignatureKeyBase({
    did,
    key,
    verificationMethod,
  })
    .addContext(SECURITY_CONTEXT_BBS_URL)
    .build()
}

function getBls12381g1g2DidDoc(did: string, key: Key) {
  const verificationMethods = getBls12381g1g2VerificationMethod(did, key)

  const didDocumentBuilder = new DidDocumentBuilder(did)

  for (const verificationMethod of verificationMethods) {
    didDocumentBuilder
      .addVerificationMethod(verificationMethod)
      .addAuthentication(verificationMethod.id)
      .addAssertionMethod(verificationMethod.id)
      .addCapabilityDelegation(verificationMethod.id)
      .addCapabilityInvocation(verificationMethod.id)
  }

  return didDocumentBuilder.addContext(SECURITY_CONTEXT_BBS_URL).build()
}

function getEd25519DidDoc(did: string, key: Key) {
  const verificationMethod = getEd25519VerificationMethod({ id: `${did}#${key.fingerprint}`, key, controller: did })

  const publicKeyX25519 = convertPublicKeyToX25519(key.publicKey)
  const didKeyX25519 = Key.fromPublicKey(publicKeyX25519, KeyType.X25519)
  const x25519VerificationMethod = getX25519VerificationMethod({
    id: `${did}#${didKeyX25519.fingerprint}`,
    key: didKeyX25519,
    controller: did,
  })

  const didDocBuilder = getSignatureKeyBase({ did, key, verificationMethod })

  didDocBuilder
    .addContext(ED25519_SUITE_CONTEXT_URL_2018)
    .addContext(SECURITY_X25519_CONTEXT_URL)
    .addKeyAgreement(x25519VerificationMethod)

  return didDocBuilder.build()
}

function getX25519DidDoc(did: string, key: Key) {
  const verificationMethod = getX25519VerificationMethod({ id: `${did}#${key.fingerprint}`, key, controller: did })

  const document = new DidDocumentBuilder(did)
    .addKeyAgreement(verificationMethod)
    .addContext(SECURITY_X25519_CONTEXT_URL)
    .build()

  return document
}

function getBls12381g2DidDoc(did: string, key: Key) {
  const verificationMethod = getBls12381g2VerificationMethod(did, key)

  return getSignatureKeyBase({
    did,
    key,
    verificationMethod,
  })
    .addContext(SECURITY_CONTEXT_BBS_URL)
    .build()
}

function getSignatureKeyBase({
  did,
  key,
  verificationMethod,
}: {
  did: string
  key: Key
  verificationMethod: VerificationMethod
}) {
  const keyId = `${did}#${key.fingerprint}`

  return new DidDocumentBuilder(did)
    .addVerificationMethod(verificationMethod)
    .addAuthentication(keyId)
    .addAssertionMethod(keyId)
    .addCapabilityDelegation(keyId)
    .addCapabilityInvocation(keyId)
}
