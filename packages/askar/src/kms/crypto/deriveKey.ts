import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { askar, Key, KeyAlgorithm } from '@openwallet-foundation/askar-shared'
import { jwkEncToAskarAlg } from '../../utils'

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

function deriveEncryptionKeyEcdh1Pu(options: {
  keyAgreement: AskarSupportedKeyAgreementEncryptOptions & { algorithm: 'ECDH-1PU+A256KW' }
  encryption: Kms.KmsEncryptDataEncryption
  senderKey: Key
  recipientKey: Key
}) {
  const { keyAgreement, encryption, senderKey, recipientKey } = options

  if (senderKey.algorithm !== KeyAlgorithm.X25519 || recipientKey.algorithm !== KeyAlgorithm.X25519) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      'ECDH-1PU+A256KW requires X25519 sender and recipient keys',
      'askar'
    )
  }
  const askarEncryptionAlgorithm = jwkEncToAskarAlg[encryption.algorithm as keyof typeof jwkEncToAskarAlg]
  if (!askarEncryptionAlgorithm) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `encryption with algorithm '${encryption.algorithm}'`,
      'askar'
    )
  }

  const ephemeralKey = Key.generate(KeyAlgorithm.X25519)
  const apu = keyAgreement.apu ? new Uint8Array(keyAgreement.apu) : new Uint8Array([])
  const apv = keyAgreement.apv ? new Uint8Array(keyAgreement.apv) : new Uint8Array([])
  const algId = TypedArrayEncoder.fromUtf8String('ECDH-1PU+A256KW')

  const derivedKey = new Key(
    askar.keyDeriveEcdh1pu({
      algorithm: KeyAlgorithm.AesA256Kw,
      ephemeralKey,
      senderKey,
      recipientKey,
      algId,
      apu,
      apv,
      receive: false,
    })
  )

  let contentEncryptionKey: Key | undefined
  let encryptedContentEncryptionKey: Kms.KmsEncryptedKey | undefined
  try {
    contentEncryptionKey = Key.generate(askarEncryptionAlgorithm)
    const wrappedKey = derivedKey.wrapKey({
      other: contentEncryptionKey,
    })
    const epkBytes = ephemeralKey.publicBytes
    const ephemeralPublicKey: Kms.KmsJwkPublicOkp = {
      kty: 'OKP',
      crv: 'X25519',
      x: TypedArrayEncoder.toBase64Url(epkBytes),
    }
    encryptedContentEncryptionKey = {
      encrypted: new Uint8Array(wrappedKey.ciphertext),
      iv: wrappedKey.nonce ? new Uint8Array(wrappedKey.nonce) : undefined,
      tag: wrappedKey.tag ? new Uint8Array(wrappedKey.tag) : undefined,
      ephemeralPublicKey,
    }
    return {
      contentEncryptionKey,
      encryptedContentEncryptionKey,
    }
  } finally {
    ephemeralKey.handle.free()
    derivedKey.handle.free()
    if (contentEncryptionKey) {
      // contentEncryptionKey is returned to caller; they free it
    }
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

  // ECDH-1PU+A256KW: generate ephemeral key, derive KEK via askar.keyDeriveEcdh1pu, wrap CEK
  if (keyAgreement.algorithm === 'ECDH-1PU+A256KW') {
    return deriveEncryptionKeyEcdh1Pu({
      keyAgreement,
      encryption,
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
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      'ECDH-1PU+A256KW requires X25519 recipient key',
      'askar'
    )
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

  const derivedKey = new Key(
    askar.keyDeriveEcdh1pu({
      algorithm: KeyAlgorithm.AesA256Kw,
      ephemeralKey,
      senderKey,
      recipientKey,
      algId,
      apu,
      apv,
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
