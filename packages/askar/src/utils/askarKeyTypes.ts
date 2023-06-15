import { KeyType } from '@aries-framework/core'
import { KeyAlgs } from '@hyperledger/aries-askar-shared'

const keyTypeToAskarAlg = {
  [KeyType.Ed25519]: KeyAlgs.Ed25519,
  [KeyType.X25519]: KeyAlgs.X25519,
  [KeyType.Bls12381g1]: KeyAlgs.Bls12381G1,
  [KeyType.Bls12381g2]: KeyAlgs.Bls12381G2,
  [KeyType.Bls12381g1g2]: KeyAlgs.Bls12381G1G2,
  [KeyType.P256]: KeyAlgs.EcSecp256r1,
} as const

export const isKeyTypeSupportedByAskar = (keyType: KeyType) => keyType in keyTypeToAskarAlg

export const keyTypesSupportedByAskar = Object.keys(keyTypeToAskarAlg) as KeyType[]
