import type { KeyDidMapping } from './keyDidMapping'

import { Key } from '../../../../crypto/Key'
import { KeyType } from '../../../../crypto/KeyType'
import { AriesFrameworkError } from '../../../../error'
import { getBls12381G1Key2020, getBls12381G2Key2020 } from '../verificationMethod'

export function getBls12381g1g2VerificationMethod(did: string, key: Key) {
  const g1PublicKey = key.publicKey.slice(0, 48)
  const g2PublicKey = key.publicKey.slice(48)

  const bls12381g1Key = Key.fromPublicKey(g1PublicKey, KeyType.Bls12381g1)
  const bls12381g2Key = Key.fromPublicKey(g2PublicKey, KeyType.Bls12381g2)

  const bls12381g1VerificationMethod = getBls12381G1Key2020({
    id: `${did}#${bls12381g1Key.fingerprint}`,
    key: bls12381g1Key,
    controller: did,
  })
  const bls12381g2VerificationMethod = getBls12381G2Key2020({
    id: `${did}#${bls12381g2Key.fingerprint}`,
    key: bls12381g2Key,
    controller: did,
  })

  return [bls12381g1VerificationMethod, bls12381g2VerificationMethod]
}

export const keyDidBls12381g1g2: KeyDidMapping = {
  supportedVerificationMethodTypes: [],
  // For a G1G2 key, we return two verification methods
  getVerificationMethods: getBls12381g1g2VerificationMethod,
  getKeyFromVerificationMethod: () => {
    throw new AriesFrameworkError('Not supported for bls12381g1g2 key')
  },
}
