import { Kms } from '@credo-ts/core'
import { Key, KeyAlgorithm } from '@openwallet-foundation/askar-shared'
import {
  AEAD_AES_128_GCM,
  AEAD_AES_256_GCM,
  KDF_HKDF_SHA256,
  KEM_DHKEM_P256_HKDF_SHA256,
  KEM_DHKEM_X25519_HKDF_SHA256,
} from '@panva/hpke-noble'
import {
  type AEADFactory,
  CipherSuite,
  concat,
  encode,
  type Key as HpkeKey,
  I2OSP,
  type KDFFactory,
  type KEM,
  type KEMFactory,
  LabeledExpand,
  LabeledExtract,
} from 'hpke'

export const askarSupportedHpkeAlgorithms = ['HPKE-0', 'HPKE-3', 'HPKE-7'] satisfies Kms.KnownJwaHpkeAlgorithm[]

export type AskarSupportedHpkeAlgorithm = (typeof askarSupportedHpkeAlgorithms)[number]

type HpkeSuiteDefinition = {
  kem: KEMFactory
  kdf: KDFFactory
  aead: AEADFactory
  /**
   * The curve the KEM is defined over. HPKE binds the KEM to the suite, so a key on another curve
   * can never be used with this algorithm.
   */
  crv: 'P-256' | 'X25519'
  askarKeyAlgorithm: KeyAlgorithm
}

/**
 * The @panva/hpke-noble providers are used rather than the WebCrypto-based defaults, so the same
 * code path works on React Native where WebCrypto is not available.
 */
const hpkeSuites = {
  'HPKE-0': {
    kem: KEM_DHKEM_P256_HKDF_SHA256,
    kdf: KDF_HKDF_SHA256,
    aead: AEAD_AES_128_GCM,
    crv: 'P-256',
    askarKeyAlgorithm: KeyAlgorithm.EcSecp256r1,
  },
  'HPKE-3': {
    kem: KEM_DHKEM_X25519_HKDF_SHA256,
    kdf: KDF_HKDF_SHA256,
    aead: AEAD_AES_128_GCM,
    crv: 'X25519',
    askarKeyAlgorithm: KeyAlgorithm.X25519,
  },
  'HPKE-7': {
    kem: KEM_DHKEM_P256_HKDF_SHA256,
    kdf: KDF_HKDF_SHA256,
    aead: AEAD_AES_256_GCM,
    crv: 'P-256',
    askarKeyAlgorithm: KeyAlgorithm.EcSecp256r1,
  },
} as const satisfies Record<AskarSupportedHpkeAlgorithm, HpkeSuiteDefinition>

function getHpkeSuite(algorithm: string): HpkeSuiteDefinition {
  const suite = hpkeSuites[algorithm as AskarSupportedHpkeAlgorithm]
  if (!suite) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(`JWA key agreement algorithm '${algorithm}'`, 'askar')
  }

  return suite
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

export async function hpkeSeal(options: {
  algorithm: string
  recipientPublicJwk: Kms.KmsJwkPublic
  data: Uint8Array
  info?: Uint8Array
  aad?: Uint8Array
}): Promise<{ encrypted: Uint8Array; encapsulatedKey: Uint8Array }> {
  const suite = getHpkeSuite(options.algorithm)
  const cipherSuite = new CipherSuite(suite.kem, suite.kdf, suite.aead)

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
  /**
   * The recipient's private key, held by Askar. The key material is never exported; only the raw
   * Diffie-Hellman output leaves Askar, as HPKE's ExtractAndExpand is performed here.
   */
  recipientKey: Key
  recipientPublicJwk: Kms.KmsJwkPublic
  encapsulatedKey: Uint8Array
  encrypted: Uint8Array
  info?: Uint8Array
  aad?: Uint8Array
}): Promise<Uint8Array> {
  const suite = getHpkeSuite(options.algorithm)
  const recipientPublicKey = serializePublicKey(options.recipientPublicJwk, suite)

  const cipherSuite = new CipherSuite(
    askarKemFactory(suite, options.recipientKey, recipientPublicKey),
    suite.kdf,
    suite.aead
  )

  return await cipherSuite.Open(askarPrivateKeyRef, options.encapsulatedKey, options.encrypted, {
    info: options.info,
    aad: options.aad,
  })
}

const askarPrivateKeyRef: HpkeKey = {
  algorithm: { name: 'ASKAR' },
  extractable: false,
  type: 'private',
}

function unsupported(operation: string): never {
  throw new Kms.KeyManagementError(`Askar-backed HPKE KEM does not support '${operation}'`)
}

/**
 * A KEM that delegates only the Diffie-Hellman step to Askar, so the recipient private key stays
 * inside the store. Everything else (ExtractAndExpand, key schedule, AEAD) is the standard HPKE
 * construction.
 *
 * Only `Decap` is implemented — sealing does not involve a private key and uses the plain suite.
 */
function askarKemFactory(
  suite: HpkeSuiteDefinition,
  recipientKey: Key,
  recipientPublicKey: Uint8Array
): KEMFactory<HpkeKey> {
  const base = suite.kem()
  const suiteId = concat(encode('KEM'), I2OSP(base.id, 2))

  const kem: KEM<HpkeKey> = {
    id: base.id,
    type: 'KEM',
    name: base.name,
    Nsecret: base.Nsecret,
    Nenc: base.Nenc,
    Npk: base.Npk,
    Nsk: base.Nsk,

    DeriveKeyPair: () => unsupported('DeriveKeyPair'),
    GenerateKeyPair: () => unsupported('GenerateKeyPair'),
    SerializePublicKey: async () => recipientPublicKey,
    DeserializePublicKey: () => unsupported('DeserializePublicKey'),
    SerializePrivateKey: () => unsupported('SerializePrivateKey'),
    DeserializePrivateKey: () => unsupported('DeserializePrivateKey'),
    Encap: () => unsupported('Encap'),

    Decap: async (enc) => {
      const ephemeralPublicKey = Key.fromPublicBytes({ algorithm: suite.askarKeyAlgorithm, publicKey: enc })

      try {
        // Askar derives a key of the requested algorithm from the raw Diffie-Hellman output;
        // a256gcm is used because its 32-byte key is exactly the shared secret for both KEMs here.
        const sharedSecretKey = recipientKey.keyFromKeyExchange({
          algorithm: KeyAlgorithm.AesA256Gcm,
          publicKey: ephemeralPublicKey,
        })

        try {
          const dh = sharedSecretKey.secretBytes
          const kemContext = concat(enc, recipientPublicKey)

          const eaePrk = await LabeledExtract(suite.kdf(), suiteId, new Uint8Array(), encode('eae_prk'), dh)
          return await LabeledExpand(suite.kdf(), suiteId, eaePrk, encode('shared_secret'), kemContext, base.Nsecret)
        } finally {
          sharedSecretKey.handle.free()
        }
      } finally {
        ephemeralPublicKey.handle.free()
      }
    },
  }

  return () => kem
}
