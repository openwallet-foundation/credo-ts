import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import type { Askar } from '@openwallet-foundation/askar-shared'
import { Key, KeyAlgorithm } from '@openwallet-foundation/askar-shared'
import { jwkEncToAskarAlg } from '../../utils'
import type { AskarSupportedDecryptionOptions } from './decrypt'
import { type AskarSupportedEncryptionOptions, aeadEncrypt } from './encrypt'

export const askarSupportedKeyAgreementAlgorithms = [
  'ECDH-ES',
  'ECDH-ES+A128KW',
  'ECDH-ES+A256KW',
  'ECDH-1PU+A256KW',
  'ECDH-HSALSA20',
] satisfies Kms.KnownJwaKeyAgreementAlgorithm[]

type AskarEcdhAlgorithm = Exclude<(typeof askarSupportedKeyAgreementAlgorithms)[number], 'ECDH-HSALSA20'>

export type AskarEcdhKeyAgreementEncryptOptions = Kms.KmsKeyAgreementEncryptOptions & { algorithm: AskarEcdhAlgorithm }

type AskarEcdhKeyAgreementDecryptOptions = Kms.KmsKeyAgreementDecryptOptions & { algorithm: AskarEcdhAlgorithm }

function deriveEcdhKey(options: {
  askar: Askar
  keyAgreement: { algorithm: AskarEcdhAlgorithm; apu?: Uint8Array; apv?: Uint8Array }
  contentEncryptionAlgorithm: keyof typeof jwkEncToAskarAlg
  ephemeralKey: Key
  senderKey?: Key
  recipientKey: Key
  ccTag?: Uint8Array
  receive: boolean
}): Key {
  const { askar, keyAgreement, contentEncryptionAlgorithm, ephemeralKey, senderKey, recipientKey, ccTag, receive } =
    options
  const apu = new Uint8Array(keyAgreement.apu ?? [])
  const apv = new Uint8Array(keyAgreement.apv ?? [])

  if (keyAgreement.algorithm === 'ECDH-ES') {
    return new Key(
      askar.keyDeriveEcdhEs({
        algorithm: jwkEncToAskarAlg[contentEncryptionAlgorithm],
        algId: TypedArrayEncoder.fromUtf8String(contentEncryptionAlgorithm),
        apu,
        apv,
        ephemeralKey,
        recipientKey,
        receive,
      })
    )
  }

  const algId = TypedArrayEncoder.fromUtf8String(keyAgreement.algorithm)
  if (keyAgreement.algorithm === 'ECDH-1PU+A256KW') {
    if (!senderKey) {
      throw new Kms.KeyManagementError(`Missing sender key for key agreement algorithm '${keyAgreement.algorithm}'`)
    }

    return new Key(
      askar.keyDeriveEcdh1pu({
        algorithm: KeyAlgorithm.AesA256Kw,
        algId,
        apu,
        apv,
        ephemeralKey,
        senderKey,
        recipientKey,
        ccTag,
        receive,
      })
    )
  }

  return new Key(
    askar.keyDeriveEcdhEs({
      algorithm: keyAgreement.algorithm === 'ECDH-ES+A128KW' ? KeyAlgorithm.AesA128Kw : KeyAlgorithm.AesA256Kw,
      algId,
      apu,
      apv,
      ephemeralKey,
      recipientKey,
      receive,
    })
  )
}

export function encryptEcdh(options: {
  askar: Askar
  keyAgreement: AskarEcdhKeyAgreementEncryptOptions
  encryption: AskarSupportedEncryptionOptions
  aad?: Uint8Array
  ephemeralKey: Key
  senderKey?: Key
  recipientKeys: Key[]
  data: Uint8Array
}): { encrypted: Uint8Array; iv: Uint8Array; tag: Uint8Array; encryptedKeys?: Kms.KmsEncryptedKey[] } {
  const { askar, keyAgreement, encryption, aad, ephemeralKey, senderKey, recipientKeys, data } = options

  if (keyAgreement.algorithm === 'ECDH-ES') {
    const contentEncryptionKey = deriveEcdhKey({
      askar,
      keyAgreement,
      contentEncryptionAlgorithm: encryption.algorithm,
      ephemeralKey,
      recipientKey: recipientKeys[0],
      receive: false,
    })

    try {
      return aeadEncrypt({ key: contentEncryptionKey, encryption, aad, data })
    } finally {
      contentEncryptionKey.handle.free()
    }
  }

  const contentEncryptionKey = Key.generate(jwkEncToAskarAlg[encryption.algorithm])
  const keysToFree = [contentEncryptionKey]
  try {
    // ECDH-1PU puts the tag into the KDF, so the content is encrypted before the key is wrapped
    const { encrypted, iv, tag } = aeadEncrypt({ key: contentEncryptionKey, encryption, aad, data })

    const encryptedKeys = recipientKeys.map((recipientKey) => {
      const keyEncryptionKey = deriveEcdhKey({
        askar,
        keyAgreement,
        contentEncryptionAlgorithm: encryption.algorithm,
        ephemeralKey,
        senderKey,
        recipientKey,
        ccTag: tag,
        receive: false,
      })
      keysToFree.push(keyEncryptionKey)

      return { encrypted: new Uint8Array(keyEncryptionKey.wrapKey({ other: contentEncryptionKey }).ciphertext) }
    })

    return { encrypted, iv, tag, encryptedKeys }
  } finally {
    for (const key of keysToFree) key.handle.free()
  }
}

export function deriveDecryptionKey(options: {
  askar: Askar
  keyAgreement: AskarEcdhKeyAgreementDecryptOptions
  decryption: AskarSupportedDecryptionOptions
  recipientKey: Key
  ephemeralKey: Key
  senderKey?: Key
}): { contentEncryptionKey: Key } {
  const { askar, keyAgreement, decryption, recipientKey, ephemeralKey, senderKey } = options

  const derivedKey = deriveEcdhKey({
    askar,
    keyAgreement,
    contentEncryptionAlgorithm: decryption.algorithm,
    ephemeralKey,
    senderKey,
    recipientKey,
    ccTag: new Uint8Array(decryption.tag),
    receive: true,
  })
  if (keyAgreement.algorithm === 'ECDH-ES') return { contentEncryptionKey: derivedKey }

  try {
    return {
      contentEncryptionKey: derivedKey.unwrapKey({
        ciphertext: new Uint8Array(keyAgreement.encryptedKey.encrypted),
        algorithm: jwkEncToAskarAlg[decryption.algorithm],
      }),
    }
  } finally {
    derivedKey.handle.free()
  }
}
