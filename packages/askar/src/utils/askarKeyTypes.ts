import { KeyType } from '@aries-framework/core'
import { KeyAlgs } from 'aries-askar-test-shared'

export function askarKeyType(keyType: KeyType) {
  const table = {
    [KeyType.Bls12381g1]: KeyAlgs.Bls12381G1,
    [KeyType.Bls12381g1g2]: KeyAlgs.Bls12381G1, // TODO: Verify if it's valid
    [KeyType.Bls12381g2]: KeyAlgs.Bls12381G2,
    [KeyType.Ed25519]: KeyAlgs.Ed25519,
    [KeyType.X25519]: KeyAlgs.X25519,
  }

  return table[keyType]
}
