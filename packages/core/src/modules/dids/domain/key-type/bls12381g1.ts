import type { KeyDidMapping } from './keyDidMapping'
import type { VerificationMethod } from '../verificationMethod'

import { KeyType } from '../../../../crypto'
import { Key } from '../../../../crypto/Key'

const VERIFICATION_METHOD_TYPE_BLS12381G1_KEY_2020 = 'Bls12381G1Key2020'

export function getBls12381g1VerificationMethod(did: string, key: Key) {
  return {
    id: `${did}#${key.fingerprint}`,
    type: VERIFICATION_METHOD_TYPE_BLS12381G1_KEY_2020,
    controller: did,
    publicKeyBase58: key.publicKeyBase58,
  }
}

export const keyDidBls12381g1: KeyDidMapping = {
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_BLS12381G1_KEY_2020],

  getVerificationMethods: (did, key) => [getBls12381g1VerificationMethod(did, key)],
  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (
      verificationMethod.type !== VERIFICATION_METHOD_TYPE_BLS12381G1_KEY_2020 ||
      !verificationMethod.publicKeyBase58
    ) {
      throw new Error('Invalid verification method passed')
    }

    return Key.fromPublicKeyBase58(verificationMethod.publicKeyBase58, KeyType.Bls12381g1)
  },
}
