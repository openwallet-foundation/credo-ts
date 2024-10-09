import { KeyType } from '@credo-ts/core'
import { KeyAlgs } from '@hyperledger/aries-askar-shared'

export enum AskarKeyTypePurpose {
  KeyManagement = 'KeyManagement',
  Signing = 'Signing',
  Encryption = 'Encryption',
}

const keyTypeToAskarAlg = {
  [KeyType.Ed25519]: {
    keyAlg: KeyAlgs.Ed25519,
    purposes: [AskarKeyTypePurpose.KeyManagement, AskarKeyTypePurpose.Signing],
  },
  [KeyType.X25519]: {
    keyAlg: KeyAlgs.X25519,
    purposes: [AskarKeyTypePurpose.KeyManagement, AskarKeyTypePurpose.Signing],
  },
  [KeyType.Bls12381g1]: {
    keyAlg: KeyAlgs.Bls12381G1,
    purposes: [AskarKeyTypePurpose.KeyManagement],
  },
  [KeyType.Bls12381g2]: {
    keyAlg: KeyAlgs.Bls12381G2,
    purposes: [AskarKeyTypePurpose.KeyManagement],
  },
  [KeyType.Bls12381g1g2]: {
    keyAlg: KeyAlgs.Bls12381G1,
    purposes: [AskarKeyTypePurpose.KeyManagement],
  },
  [KeyType.P256]: {
    keyAlg: KeyAlgs.EcSecp256r1,
    purposes: [AskarKeyTypePurpose.KeyManagement, AskarKeyTypePurpose.Signing, AskarKeyTypePurpose.Encryption],
  },
  [KeyType.K256]: {
    keyAlg: KeyAlgs.EcSecp256k1,
    purposes: [AskarKeyTypePurpose.KeyManagement, AskarKeyTypePurpose.Signing],
  },
}

export const isKeyTypeSupportedByAskarForPurpose = (keyType: KeyType, purpose: AskarKeyTypePurpose) =>
  keyType in keyTypeToAskarAlg &&
  keyTypeToAskarAlg[keyType as keyof typeof keyTypeToAskarAlg].purposes.includes(purpose)

export const keyTypesSupportedByAskar = Object.keys(keyTypeToAskarAlg) as KeyType[]
