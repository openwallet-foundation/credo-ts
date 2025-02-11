import { KeyType } from '@credo-ts/core'
import { KeyAlgorithm } from '@openwallet-foundation/askar-shared'

export enum AskarKeyTypePurpose {
  KeyManagement = 'KeyManagement',
  Signing = 'Signing',
  Encryption = 'Encryption',
}

const keyTypeToAskarAlg = {
  [KeyType.Ed25519]: {
    keyAlg: KeyAlgorithm.Ed25519,
    purposes: [AskarKeyTypePurpose.KeyManagement, AskarKeyTypePurpose.Signing],
  },
  [KeyType.X25519]: {
    keyAlg: KeyAlgorithm.X25519,
    purposes: [AskarKeyTypePurpose.KeyManagement, AskarKeyTypePurpose.Signing],
  },
  [KeyType.Bls12381g1]: {
    keyAlg: KeyAlgorithm.Bls12381G1,
    purposes: [AskarKeyTypePurpose.KeyManagement],
  },
  [KeyType.Bls12381g2]: {
    keyAlg: KeyAlgorithm.Bls12381G2,
    purposes: [AskarKeyTypePurpose.KeyManagement],
  },
  [KeyType.Bls12381g1g2]: {
    keyAlg: KeyAlgorithm.Bls12381G1,
    purposes: [AskarKeyTypePurpose.KeyManagement],
  },
  [KeyType.P256]: {
    keyAlg: KeyAlgorithm.EcSecp256r1,
    purposes: [AskarKeyTypePurpose.KeyManagement, AskarKeyTypePurpose.Signing, AskarKeyTypePurpose.Encryption],
  },
  [KeyType.K256]: {
    keyAlg: KeyAlgorithm.EcSecp256k1,
    purposes: [AskarKeyTypePurpose.KeyManagement, AskarKeyTypePurpose.Signing],
  },
}

export const isKeyTypeSupportedByAskarForPurpose = (keyType: KeyType, purpose: AskarKeyTypePurpose) =>
  keyType in keyTypeToAskarAlg &&
  keyTypeToAskarAlg[keyType as keyof typeof keyTypeToAskarAlg].purposes.includes(purpose)

export const keyTypesSupportedByAskar = Object.keys(keyTypeToAskarAlg) as KeyType[]
