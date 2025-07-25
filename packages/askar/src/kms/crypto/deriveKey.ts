import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { Key, askar } from '@openwallet-foundation/askar-shared'
import { jwkEncToAskarAlg } from '../../utils'

export const askarSupportedKeyAgreementAlgorithms = [
  'ECDH-ES',
  'ECDH-ES+A128KW',
  'ECDH-ES+A256KW',
  'ECDH-HSALSA20',
] satisfies Kms.KnownJwaKeyAgreementAlgorithm[]

type AskarSupportedKeyAgreementEncryptOptions = Kms.KmsKeyAgreementEncryptOptions & {
  algorithm: (typeof askarSupportedKeyAgreementAlgorithms)[number]
}

type AskarSupportedKeyAgreementDecryptOptions = Kms.KmsKeyAgreementDecryptOptions & {
  algorithm: (typeof askarSupportedKeyAgreementAlgorithms)[number]
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

  const askarKeyWrappingAlgorithm =
    keyAgreement.algorithm !== 'ECDH-ES'
      ? jwkEncToAskarAlg[keyAgreement.algorithm.replace('ECDH-ES+', '') as keyof typeof jwkEncToAskarAlg]
      : undefined

  const derivedKey = new Key(
    askar.keyDeriveEcdhEs({
      algId: TypedArrayEncoder.fromString(
        keyAgreement.algorithm === 'ECDH-ES' ? encryption.algorithm : keyAgreement.algorithm
      ),
      receive: false,
      apv: keyAgreement.apv ?? new Uint8Array([]),
      apu: keyAgreement.apu ?? new Uint8Array([]),
      algorithm: askarKeyWrappingAlgorithm ?? askarEncryptionAlgorithm,
      ephemeralKey: senderKey,
      recipientKey: recipientKey,
    })
  )
  let contentEncryptionKey: Key | undefined = undefined
  let encryptedContentEncryptionKey: Kms.KmsEncryptedKey | undefined
  try {
    // Key wrapping
    if (keyAgreement.algorithm !== 'ECDH-ES') {
      contentEncryptionKey = Key.generate(askarEncryptionAlgorithm)

      const wrappedKey = derivedKey.wrapKey({
        other: contentEncryptionKey,
      })
      encryptedContentEncryptionKey = {
        encrypted: wrappedKey.ciphertext,
        iv: wrappedKey.nonce,
        tag: wrappedKey.tag,
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
}) {
  const { keyAgreement, decryption, senderKey, recipientKey } = options

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

  const askarKeyWrappingAlgorithm =
    keyAgreement.algorithm !== 'ECDH-ES'
      ? jwkEncToAskarAlg[keyAgreement.algorithm.replace('ECDH-ES+', '') as keyof typeof jwkEncToAskarAlg]
      : undefined

  const derivedKey = new Key(
    askar.keyDeriveEcdhEs({
      algId: TypedArrayEncoder.fromString(
        keyAgreement.algorithm === 'ECDH-ES' ? decryption.algorithm : keyAgreement.algorithm
      ),
      receive: true,
      apv: keyAgreement.apv ?? new Uint8Array(),
      apu: keyAgreement.apu ?? new Uint8Array(),
      algorithm: askarKeyWrappingAlgorithm ?? askarEncryptionAlgorithm,
      ephemeralKey: senderKey,
      recipientKey: recipientKey,
    })
  )

  let contentEncryptionKey: Key | undefined = undefined
  try {
    // Key unwrapping
    if (keyAgreement.algorithm !== 'ECDH-ES') {
      contentEncryptionKey = derivedKey.unwrapKey({
        ciphertext: keyAgreement.encryptedKey.encrypted,
        algorithm: askarEncryptionAlgorithm,
        nonce: keyAgreement.encryptedKey.iv,
        tag: keyAgreement.encryptedKey.tag,
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
