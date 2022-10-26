import type { KeyDidMapping } from './keyDidMapping'

import { VerificationMethod } from '../verificationMethod'

import { getSignatureKeyBase } from './getSignatureKeyBase'
import { Key } from './key'
import { KeyType } from './key-type'

const VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020 = 'Bls12381G2Key2020'

export function getBls12381g2VerificationMethod(did: string, key: Key) {
  return new VerificationMethod({
    id: `${did}#${key.fingerprint}`,
    type: VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020,
    controller: did,
    publicKeyBase58: key.publicKeyBase58,
  })
}

export function getBls12381g2DidDoc(did: string, key: Key) {
  const verificationMethod = getBls12381g2VerificationMethod(did, key)

  return getSignatureKeyBase({
    did,
    key,
    verificationMethod,
  }).build()
}

export const keyDidBls12381g2: KeyDidMapping = {
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020],

  getDidDocument: getBls12381g2DidDoc,
  getVerificationMethods: (did, key) => [getBls12381g2VerificationMethod(did, key)],

  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (
      verificationMethod.type !== VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020 ||
      !verificationMethod.publicKeyBase58
    ) {
      throw new Error('Invalid verification method passed')
    }

    return Key.fromPublicKeyBase58(verificationMethod.publicKeyBase58, KeyType.Bls12381g2)
  },
}