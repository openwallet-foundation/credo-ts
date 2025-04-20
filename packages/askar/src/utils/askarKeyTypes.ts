import { KeyType, Kms } from '@credo-ts/core'
import { KeyAlgorithm } from '@openwallet-foundation/askar-shared'

export enum AskarKeyTypePurpose {
  KeyManagement = 'KeyManagement',
  Signing = 'Signing',
  Encryption = 'Encryption',
}

export const jwkCrvToAskarAlg: Partial<
  Record<Kms.KmsJwkPublicEc['crv'] | Kms.KmsJwkPublicOkp['crv'], KeyAlgorithm | undefined>
> = {
  // EC
  secp256k1: KeyAlgorithm.EcSecp256k1,
  'P-256': KeyAlgorithm.EcSecp256r1,
  'P-384': KeyAlgorithm.EcSecp384r1,

  // TODO: we need to get the JWK key representation right first
  // BLS12381G1: KeyAlgs.Bls12381G1,
  // BLS12381G2: KeyAlgs.Bls12381G2,

  // OKP
  X25519: KeyAlgorithm.X25519,
  Ed25519: KeyAlgorithm.Ed25519,
}

export const jwkEncToAskarAlg = {
  'A128CBC-HS256': KeyAlgorithm.AesA128CbcHs256,
  A128GCM: KeyAlgorithm.AesA128Gcm,
  'A256CBC-HS512': KeyAlgorithm.AesA256CbcHs512,
  A256GCM: KeyAlgorithm.AesA256Gcm,
  C20P: KeyAlgorithm.Chacha20C20P,
  XC20P: KeyAlgorithm.Chacha20XC20P,

  A128KW: KeyAlgorithm.AesA128Kw,
  A256KW: KeyAlgorithm.AesA256Kw,
} satisfies Partial<Record<Kms.KnownJwaContentEncryptionAlgorithm | Kms.KnownJwaKeyEncryptionAlgorithm, KeyAlgorithm>>

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
  [KeyType.P384]: {
    keyAlg: KeyAlgorithm.EcSecp384r1,
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
