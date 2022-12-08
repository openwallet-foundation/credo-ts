import type { KeyDidMapping } from './keyDidMapping'

import { KeyType } from '../../../../crypto'
import { Key } from '../../../../crypto/Key'

import { keyDidBuildKeyId } from './BuildKeyId'
import { getBls12381g1VerificationMethod } from './bls12381g1'
import { getBls12381g2VerificationMethod } from './bls12381g2'

export function getBls12381g1g2VerificationMethods(did: string, key: Key, buildKeyId = keyDidBuildKeyId) {
  const g1PublicKey = key.publicKey.slice(0, 48)
  const g2PublicKey = key.publicKey.slice(48)

  const bls12381g1Key = Key.fromPublicKey(g1PublicKey, KeyType.Bls12381g1)
  const bls12381g2Key = Key.fromPublicKey(g2PublicKey, KeyType.Bls12381g2)

  const bls12381g1VerificationMethod = getBls12381g1VerificationMethod({
    id: buildKeyId(did, bls12381g1Key),
    key: bls12381g1Key,
    controller: did,
  })
  const bls12381g2VerificationMethod = getBls12381g2VerificationMethod({
    id: buildKeyId(did, bls12381g2Key),
    key: bls12381g2Key,
    controller: did,
  })

  return [bls12381g1VerificationMethod, bls12381g2VerificationMethod]
}

export const keyDidBls12381g1g2: KeyDidMapping = {
  supportedVerificationMethodTypes: [],
  getVerificationMethods: getBls12381g1g2VerificationMethods,

  getKeyFromVerificationMethod: () => {
    throw new Error('Not supported for bls12381g1g2 key')
  },
}
