import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import {
  AEAD_AES_128_GCM,
  AEAD_AES_256_GCM,
  type AEADFactory,
  CipherSuite,
  KDF_HKDF_SHA256,
  type KDFFactory,
  KEM_DHKEM_P256_HKDF_SHA256,
  KEM_DHKEM_X25519_HKDF_SHA256,
  type KEMFactory,
} from 'hpke'

export const nodeSupportedHpkeAlgorithms = ['HPKE-0', 'HPKE-3', 'HPKE-7'] satisfies Kms.KnownJwaHpkeAlgorithm[]

export type NodeSupportedHpkeAlgorithm = (typeof nodeSupportedHpkeAlgorithms)[number]

type HpkeSuiteDefinition = {
  kem: KEMFactory
  kdf: KDFFactory
  aead: AEADFactory
  /**
   * The curve the KEM is defined over. HPKE binds the KEM to the suite, so a key on another curve
   * can never be used with this algorithm.
   */
  crv: 'P-256' | 'X25519'
}

const hpkeSuites = {
  'HPKE-0': {
    kem: KEM_DHKEM_P256_HKDF_SHA256,
    kdf: KDF_HKDF_SHA256,
    aead: AEAD_AES_128_GCM,
    crv: 'P-256',
  },
  'HPKE-3': {
    kem: KEM_DHKEM_X25519_HKDF_SHA256,
    kdf: KDF_HKDF_SHA256,
    aead: AEAD_AES_128_GCM,
    crv: 'X25519',
  },
  'HPKE-7': {
    kem: KEM_DHKEM_P256_HKDF_SHA256,
    kdf: KDF_HKDF_SHA256,
    aead: AEAD_AES_256_GCM,
    crv: 'P-256',
  },
} as const satisfies Record<NodeSupportedHpkeAlgorithm, HpkeSuiteDefinition>

function getHpkeCipherSuite(algorithm: string) {
  const suite = hpkeSuites[algorithm as NodeSupportedHpkeAlgorithm]
  if (!suite) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(`JWA key agreement algorithm '${algorithm}'`, 'node')
  }

  return { suite, cipherSuite: new CipherSuite(suite.kem, suite.kdf, suite.aead) }
}

/**
 * Serialize a public JWK to the raw form the KEM expects. `PublicJwk` already encodes EC keys as
 * the uncompressed SEC1 point required by the DHKEM(P-256) suites, and X25519 keys as the raw 32
 * bytes required by DHKEM(X25519).
 */
function serializePublicKey(jwk: Kms.KmsJwkPublic, suite: HpkeSuiteDefinition) {
  const publicJwk = Kms.PublicJwk.fromUnknown(jwk)

  if (suite.crv === 'X25519') {
    if (!publicJwk.is(Kms.X25519PublicJwk)) {
      throw new Kms.KeyManagementError(`HPKE suite requires an OKP key with crv 'X25519'`)
    }
    return publicJwk.publicKey.publicKey
  }

  if (!publicJwk.is(Kms.P256PublicJwk)) {
    throw new Kms.KeyManagementError(`HPKE suite requires an EC key with crv 'P-256'`)
  }

  return publicJwk.publicKey.publicKey
}

function serializePrivateKey(jwk: Kms.KmsJwkPrivate, suite: HpkeSuiteDefinition) {
  if (suite.crv === 'X25519') {
    if (jwk.kty !== 'OKP' || jwk.crv !== 'X25519') {
      throw new Kms.KeyManagementError(`HPKE suite requires an OKP key with crv 'X25519'`)
    }
    return TypedArrayEncoder.fromBase64Url(jwk.d)
  }

  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') {
    throw new Kms.KeyManagementError(`HPKE suite requires an EC key with crv 'P-256'`)
  }

  return TypedArrayEncoder.fromBase64Url(jwk.d)
}

export async function hpkeSeal(options: {
  algorithm: string
  recipientPublicJwk: Kms.KmsJwkPublic
  data: Uint8Array
  info?: Uint8Array
  aad?: Uint8Array
}): Promise<{ encrypted: Uint8Array; encapsulatedKey: Uint8Array }> {
  const { suite, cipherSuite } = getHpkeCipherSuite(options.algorithm)

  const recipientPublicKey = await cipherSuite.DeserializePublicKey(
    serializePublicKey(options.recipientPublicJwk, suite)
  )

  const { encapsulatedSecret, ciphertext } = await cipherSuite.Seal(recipientPublicKey, options.data, {
    info: options.info,
    aad: options.aad,
  })

  return { encrypted: ciphertext, encapsulatedKey: encapsulatedSecret }
}

export async function hpkeOpen(options: {
  algorithm: string
  recipientPrivateJwk: Kms.KmsJwkPrivate
  encapsulatedKey: Uint8Array
  encrypted: Uint8Array
  info?: Uint8Array
  aad?: Uint8Array
}): Promise<Uint8Array> {
  const { suite, cipherSuite } = getHpkeCipherSuite(options.algorithm)

  const recipientPrivateKey = await cipherSuite.DeserializePrivateKey(
    serializePrivateKey(options.recipientPrivateJwk, suite)
  )

  return await cipherSuite.Open(recipientPrivateKey, options.encapsulatedKey, options.encrypted, {
    info: options.info,
    aad: options.aad,
  })
}
