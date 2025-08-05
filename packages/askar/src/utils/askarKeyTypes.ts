import { Kms } from '@credo-ts/core'
import { KeyAlgorithm } from '@openwallet-foundation/askar-shared'

export const jwkCrvToAskarAlg: Partial<
  Record<Kms.KmsJwkPublicEc['crv'] | Kms.KmsJwkPublicOkp['crv'], KeyAlgorithm | undefined>
> = {
  // EC
  secp256k1: KeyAlgorithm.EcSecp256k1,
  'P-256': KeyAlgorithm.EcSecp256r1,
  'P-384': KeyAlgorithm.EcSecp384r1,

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
