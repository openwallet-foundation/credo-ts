import type { KeyDidMapping } from './keyDidMapping'

import { DidDocumentBuilder } from '../did-doc'

import { getBls12381g1VerificationMethod } from './bls12381g1'
import { getBls12381g2VerificationMethod } from './bls12381g2'
import { Key } from './key'
import { KeyType } from './key-type'

export function getBls12381g1g2VerificationMethod(did: string, key: Key) {
  const g1PublicKey = key.publicKey.slice(0, 48)
  const g2PublicKey = key.publicKey.slice(48)

  const bls12381g1Key = Key.fromPublicKey(g1PublicKey, KeyType.Bls12381g1)
  const bls12381g2Key = Key.fromPublicKey(g2PublicKey, KeyType.Bls12381g2)

  const bls12381g1VerificationMethod = getBls12381g1VerificationMethod(did, bls12381g1Key)
  const bls12381g2VerificationMethod = getBls12381g2VerificationMethod(did, bls12381g2Key)

  return [bls12381g1VerificationMethod, bls12381g2VerificationMethod]
}

export function getBls12381g1g2DidDoc(did: string, key: Key) {
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

  return didDocumentBuilder.build()
}

export const keyDidBls12381g1g2: KeyDidMapping = {
  supportedVerificationMethodTypes: [],
  getDidDocument: getBls12381g1g2DidDoc,
  getVerificationMethods: getBls12381g1g2VerificationMethod,

  getKeyFromVerificationMethod: () => {
    throw new Error('Not supported for bls12381g1g2 key')
  },
}
