import type { BuildKeyId } from './key-type'

import { KeyType, Key } from '../../../crypto'
import { SECURITY_CONTEXT_BBS_URL, SECURITY_X25519_CONTEXT_URL } from '../../vc/constants'
import { ED25519_SUITE_CONTEXT_URL_2018 } from '../../vc/signature-suites/ed25519/constants'

import { DidDocumentBuilder } from './DidDocumentBuilder'
import { keyDidBuildKeyId } from './key-type'
import { getBls12381g1VerificationMethod } from './key-type/bls12381g1'
import { getBls12381g1g2VerificationMethods } from './key-type/bls12381g1g2'
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

export function getDidDocumentForKey(did: string, key: Key, buildKeyId: BuildKeyId = keyDidBuildKeyId) {
  const getDidDocument = didDocumentKeyTypeMapping[key.keyType]

  return getDidDocument(did, key, buildKeyId)
}

function getBls12381g1DidDoc(did: string, key: Key, buildKeyId: BuildKeyId) {
  const verificationMethod = getBls12381g1VerificationMethod({ id: buildKeyId(did, key), key, controller: did })

  return new DidDocumentBuilder(did)
    .addSignatureMethodAndRelationships(verificationMethod)
    .addContext(SECURITY_CONTEXT_BBS_URL)
    .build()
}

function getBls12381g1g2DidDoc(did: string, key: Key, buildKeyId: BuildKeyId) {
  const verificationMethods = getBls12381g1g2VerificationMethods(did, key, buildKeyId)

  const didDocumentBuilder = new DidDocumentBuilder(did)
  for (const verificationMethod of verificationMethods) {
    didDocumentBuilder.addSignatureMethodAndRelationships(verificationMethod)
  }

  return didDocumentBuilder.addContext(SECURITY_CONTEXT_BBS_URL).build()
}

function getEd25519DidDoc(did: string, key: Key, buildKeyId: BuildKeyId) {
  const verificationMethod = getEd25519VerificationMethod({ id: buildKeyId(did, key), key, controller: did })

  const x25519PublicKey = convertPublicKeyToX25519(key.publicKey)
  const x25519Key = Key.fromPublicKey(x25519PublicKey, KeyType.X25519)

  const x25519VerificationMethod = getX25519VerificationMethod({
    id: buildKeyId(did, x25519Key),
    key: x25519Key,
    controller: did,
  })

  const didDocBuilder = new DidDocumentBuilder(did).addSignatureMethodAndRelationships(verificationMethod)

  didDocBuilder
    .addKeyAgreement(x25519VerificationMethod)
    .addContext(ED25519_SUITE_CONTEXT_URL_2018)
    .addContext(SECURITY_X25519_CONTEXT_URL)

  return didDocBuilder.build()
}

function getX25519DidDoc(did: string, key: Key, buildKeyId: BuildKeyId) {
  const verificationMethod = getX25519VerificationMethod({ id: buildKeyId(did, key), key, controller: did })

  const document = new DidDocumentBuilder(did)
    .addKeyAgreement(verificationMethod)
    .addContext(SECURITY_X25519_CONTEXT_URL)
    .build()

  return document
}

function getBls12381g2DidDoc(did: string, key: Key, buildKeyId: BuildKeyId) {
  const verificationMethod = getBls12381g2VerificationMethod({ id: buildKeyId(did, key), key, controller: did })

  return new DidDocumentBuilder(did)
    .addSignatureMethodAndRelationships(verificationMethod)
    .addContext(SECURITY_CONTEXT_BBS_URL)
    .build()
}
