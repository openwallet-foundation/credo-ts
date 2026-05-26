import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { askar, Key, KeyAlgorithm } from '@openwallet-foundation/askar-shared'
import { jwkEncToAskarAlg } from '../../utils'
import { type AskarSupportedEncryptionOptions, aeadEncrypt } from './encrypt'

export const askarSupportedKeyAgreementAlgorithms = [
  'ECDH-ES',
  'ECDH-ES+A128KW',
  'ECDH-ES+A256KW',
  'ECDH-1PU+A256KW',
  'ECDH-HSALSA20',
] satisfies Kms.KnownJwaKeyAgreementAlgorithm[]

type AskarSupportedKeyAgreementEncryptOptions = Kms.KmsKeyAgreementEncryptOptions & {
  algorithm: (typeof askarSupportedKeyAgreementAlgorithms)[number]
}

type AskarSupportedKeyAgreementDecryptOptions = Kms.KmsKeyAgreementDecryptOptions & {
  algorithm: (typeof askarSupportedKeyAgreementAlgorithms)[number]
}

/**
 * Full ECDH-1PU+A256KW encrypt flow per draft-madden-jose-ecdh-1pu-04 §2.3:
 * encrypt content with a fresh CEK first, then derive the KEK with the resulting JWE
 * Authentication Tag bound into SuppPubInfo, then wrap the CEK with that KEK. The KEK
 * cannot be derived before content encryption because it depends on the tag.
 */
export function encryptEcdh1Pu(options: {
  keyAgreement: AskarSupportedKeyAgreementEncryptOptions & { algorithm: 'ECDH-1PU+A256KW' }
  encryption: AskarSupportedEncryptionOptions
  senderKey: Key
  recipientKey: Key
  data: Uint8Array
  ephemeralKey?: Key
}) {
  const { keyAgreement, encryption, senderKey, recipientKey, data, ephemeralKey: providedEphemeralKey } = options

  if (senderKey.algorithm !== KeyAlgorithm.X25519 || recipientKey.algorithm !== KeyAlgorithm.X25519) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      'ECDH-1PU+A256KW requires X25519 sender and recipient keys',
      'askar'
    )
  }
  if (providedEphemeralKey && providedEphemeralKey.algorithm !== KeyAlgorithm.X25519) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError('ECDH-1PU+A256KW requires an X25519 ephemeral key', 'askar')
  }
  const askarEncryptionAlgorithm = jwkEncToAskarAlg[encryption.algorithm as keyof typeof jwkEncToAskarAlg]
  if (!askarEncryptionAlgorithm) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `encryption with algorithm '${encryption.algorithm}'`,
      'askar'
    )
  }

  const ephemeralKey = providedEphemeralKey ?? Key.generate(KeyAlgorithm.X25519)
  const ownsEphemeralKey = !providedEphemeralKey
  const apu = keyAgreement.apu ? new Uint8Array(keyAgreement.apu) : new Uint8Array([])
  const apv = keyAgreement.apv ? new Uint8Array(keyAgreement.apv) : new Uint8Array([])
  const algId = TypedArrayEncoder.fromUtf8String('ECDH-1PU+A256KW')

  const contentEncryptionKey = Key.generate(askarEncryptionAlgorithm)
  let derivedKey: Key | undefined
  try {
    const aeadResult = aeadEncrypt({ key: contentEncryptionKey, data, encryption })

    derivedKey = new Key(
      askar.keyDeriveEcdh1pu({
        algorithm: KeyAlgorithm.AesA256Kw,
        ephemeralKey,
        senderKey,
        recipientKey,
        algId,
        apu,
        apv,
        ccTag: aeadResult.tag,
        receive: false,
      })
    )
    const wrappedKey = derivedKey.wrapKey({ other: contentEncryptionKey })
    const ephemeralPublicKey = {
      kty: 'OKP',
      crv: 'X25519',
      x: TypedArrayEncoder.toBase64Url(ephemeralKey.publicBytes),
    } as const

    return {
      encrypted: aeadResult.encrypted,
      iv: aeadResult.iv,
      tag: aeadResult.tag,
      encryptedKey: {
        encrypted: new Uint8Array(wrappedKey.ciphertext),
        iv: wrappedKey.nonce ? new Uint8Array(wrappedKey.nonce) : undefined,
        tag: wrappedKey.tag ? new Uint8Array(wrappedKey.tag) : undefined,
        ephemeralPublicKey,
      } satisfies Kms.KmsEncryptedKey,
    }
  } finally {
    if (ownsEphemeralKey) ephemeralKey.handle.free()
    derivedKey?.handle.free()
    contentEncryptionKey.handle.free()
  }
}

export function deriveEncryptionKey(options: {
  keyAgreement: AskarSupportedKeyAgreementEncryptOptions
  senderKey: Key
  recipientKey: Key
  encryption: Kms.KmsEncryptDataEncryption
}) {
  const { keyAgreement, encryption, senderKey, recipientKey } = options

  const askarEncryptionAlgorithm = jwkEncToAskarAlg[encryption.algorithm as keyof typeof jwkEncToAskarAlg]
  if (!askarEncryptionAlgorithm) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `encryption with algorithm '${encryption.algorithm}'`,
      'askar'
    )
  }

  // This should be handled on a higher level as we only support combined key agreemnt + encryption
  if (keyAgreement.algorithm === 'ECDH-HSALSA20') {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `derive key for algorithm '${keyAgreement.algorithm}' with encryption algorithm '${encryption.algorithm}'`,
      'askar'
    )
  }

  // ECDH-1PU+A256KW requires the JWE Authentication Tag in the KDF, so it goes through encryptEcdh1Pu
  // which performs content encryption + key wrapping atomically. Callers that reach this dispatcher
  // with 1PU are programming errors.
  if (keyAgreement.algorithm === 'ECDH-1PU+A256KW') {
    throw new Kms.KeyManagementError('Use encryptEcdh1Pu for ECDH-1PU+A256KW; deriveEncryptionKey only handles ECDH-ES')
  }

  const askarKeyWrappingAlgorithm =
    keyAgreement.algorithm !== 'ECDH-ES'
      ? jwkEncToAskarAlg[keyAgreement.algorithm.replace('ECDH-ES+', '') as keyof typeof jwkEncToAskarAlg]
      : undefined

  const derivedKey = new Key(
    askar.keyDeriveEcdhEs({
      algId: TypedArrayEncoder.fromUtf8String(
        keyAgreement.algorithm === 'ECDH-ES' ? encryption.algorithm : keyAgreement.algorithm
      ),
      receive: false,
      apv: keyAgreement.apv ? new Uint8Array(keyAgreement.apv) : new Uint8Array([]),
      apu: keyAgreement.apu ? new Uint8Array(keyAgreement.apu) : new Uint8Array([]),
      algorithm: askarKeyWrappingAlgorithm ?? askarEncryptionAlgorithm,
      ephemeralKey: senderKey,
      recipientKey: recipientKey,
    })
  )
  let contentEncryptionKey: Key | undefined
  let encryptedContentEncryptionKey: Kms.KmsEncryptedKey | undefined
  try {
    // Key wrapping
    if (keyAgreement.algorithm !== 'ECDH-ES') {
      contentEncryptionKey = Key.generate(askarEncryptionAlgorithm)

      const wrappedKey = derivedKey.wrapKey({
        other: contentEncryptionKey,
      })
      encryptedContentEncryptionKey = {
        encrypted: new Uint8Array(wrappedKey.ciphertext),
        iv: new Uint8Array(wrappedKey.nonce),
        tag: new Uint8Array(wrappedKey.tag),
      }
    }

    return {
      contentEncryptionKey: contentEncryptionKey ?? derivedKey,
      encryptedContentEncryptionKey,
    }
  } catch (error) {
    if (contentEncryptionKey) {
      contentEncryptionKey.handle.free()
    }
    // We only free the derived key if there is no content encryption key
    // as in this case the derived key is already freed in the finally clause
    else {
      derivedKey.handle.free()
    }

    throw error
  } finally {
    // If there is a content encryption key, it means we can free the
    // derived key
    if (contentEncryptionKey) {
      derivedKey.handle.free()
    }
  }
}

export function deriveDecryptionKey(options: {
  keyAgreement: AskarSupportedKeyAgreementDecryptOptions
  senderKey: Key
  recipientKey: Key
  decryption: Kms.KmsDecryptDataDecryption
  /** For ECDH-1PU+A256KW: ephemeral public key from the JWE header */
  ephemeralKey?: Key
}) {
  const { keyAgreement, decryption, senderKey, recipientKey, ephemeralKey } = options

  const askarEncryptionAlgorithm = jwkEncToAskarAlg[decryption.algorithm as keyof typeof jwkEncToAskarAlg]
  if (!askarEncryptionAlgorithm) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `decryption with algorithm '${decryption.algorithm}'`,
      'askar'
    )
  }

  if (keyAgreement.algorithm === 'ECDH-HSALSA20') {
    // This should be handled on a higher level as we only support combined key agreemnt + encryption
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `derive key for algorithm '${keyAgreement.algorithm}' with encryption algorithm '${decryption.algorithm}'`,
      'askar'
    )
  }

  // ECDH-1PU+A256KW: ephemeralKey and senderKey (sender public) are required
  if (keyAgreement.algorithm === 'ECDH-1PU+A256KW') {
    if (!ephemeralKey) {
      throw new Kms.KeyManagementError('ECDH-1PU+A256KW decrypt requires ephemeralKey (ephemeral public key from JWE)')
    }
    return deriveDecryptionKeyEcdh1Pu({
      keyAgreement: keyAgreement as AskarSupportedKeyAgreementDecryptOptions & { algorithm: 'ECDH-1PU+A256KW' },
      decryption,
      ephemeralKey,
      senderKey,
      recipientKey,
    })
  }

  const askarKeyWrappingAlgorithm =
    keyAgreement.algorithm !== 'ECDH-ES'
      ? jwkEncToAskarAlg[keyAgreement.algorithm.replace('ECDH-ES+', '') as keyof typeof jwkEncToAskarAlg]
      : undefined

  const derivedKey = new Key(
    askar.keyDeriveEcdhEs({
      algId: TypedArrayEncoder.fromUtf8String(
        keyAgreement.algorithm === 'ECDH-ES' ? decryption.algorithm : keyAgreement.algorithm
      ),
      receive: true,
      apv: keyAgreement.apv ? new Uint8Array(keyAgreement.apv) : new Uint8Array(),
      apu: keyAgreement.apu ? new Uint8Array(keyAgreement.apu) : new Uint8Array(),
      algorithm: askarKeyWrappingAlgorithm ?? askarEncryptionAlgorithm,
      ephemeralKey: senderKey,
      recipientKey: recipientKey,
    })
  )

  let contentEncryptionKey: Key | undefined
  try {
    // Key unwrapping
    if (keyAgreement.algorithm !== 'ECDH-ES') {
      contentEncryptionKey = derivedKey.unwrapKey({
        ciphertext: new Uint8Array(keyAgreement.encryptedKey.encrypted),
        algorithm: askarEncryptionAlgorithm,
        nonce: keyAgreement.encryptedKey.iv ? new Uint8Array(keyAgreement.encryptedKey.iv) : undefined,
        tag: keyAgreement.encryptedKey.tag ? new Uint8Array(keyAgreement.encryptedKey.tag) : undefined,
      })
    }

    return {
      contentEncryptionKey: contentEncryptionKey ?? derivedKey,
    }
  } catch (error) {
    if (contentEncryptionKey) {
      contentEncryptionKey.handle.free()
    } else {
      derivedKey.handle.free()
    }
    throw error
  } finally {
    if (contentEncryptionKey) {
      derivedKey.handle.free()
    }
  }
}

function deriveDecryptionKeyEcdh1Pu(options: {
  keyAgreement: AskarSupportedKeyAgreementDecryptOptions & { algorithm: 'ECDH-1PU+A256KW' }
  decryption: Kms.KmsDecryptDataDecryption
  ephemeralKey: Key
  senderKey: Key
  recipientKey: Key
}) {
  const { keyAgreement, decryption, ephemeralKey, senderKey, recipientKey } = options

  if (recipientKey.algorithm !== KeyAlgorithm.X25519) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError('ECDH-1PU+A256KW requires X25519 recipient key', 'askar')
  }

  const askarEncryptionAlgorithm = jwkEncToAskarAlg[decryption.algorithm as keyof typeof jwkEncToAskarAlg]
  if (!askarEncryptionAlgorithm) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `decryption with algorithm '${decryption.algorithm}'`,
      'askar'
    )
  }

  const apu = keyAgreement.apu ? new Uint8Array(keyAgreement.apu) : new Uint8Array([])
  const apv = keyAgreement.apv ? new Uint8Array(keyAgreement.apv) : new Uint8Array([])
  const algId = TypedArrayEncoder.fromUtf8String('ECDH-1PU+A256KW')
  // draft-madden-jose-ecdh-1pu-04 binds the JWE Authentication Tag into the KDF SuppPubInfo
  // for the Key Wrapping variants of ECDH-1PU.
  const decryptionTag = 'tag' in decryption ? decryption.tag : undefined
  const ccTag = decryptionTag ? new Uint8Array(decryptionTag) : undefined

  const derivedKey = new Key(
    askar.keyDeriveEcdh1pu({
      algorithm: KeyAlgorithm.AesA256Kw,
      ephemeralKey,
      senderKey,
      recipientKey,
      algId,
      apu,
      apv,
      ccTag,
      receive: true,
    })
  )

  try {
    const contentEncryptionKey = derivedKey.unwrapKey({
      ciphertext: new Uint8Array(keyAgreement.encryptedKey.encrypted),
      algorithm: askarEncryptionAlgorithm,
      nonce: keyAgreement.encryptedKey.iv ? new Uint8Array(keyAgreement.encryptedKey.iv) : undefined,
      tag: keyAgreement.encryptedKey.tag ? new Uint8Array(keyAgreement.encryptedKey.tag) : undefined,
    })
    return {
      contentEncryptionKey,
    }
  } finally {
    derivedKey.handle.free()
  }
}
