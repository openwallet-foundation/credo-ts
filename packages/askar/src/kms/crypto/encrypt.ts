import { Kms } from '@credo-ts/core'
import { Key } from '@openwallet-foundation/askar-shared'
import { jwkEncToAskarAlg } from '../../utils'

export type AskarSupportedEncryptionOptions = Kms.KmsEncryptDataEncryption & {
  algorithm: keyof typeof jwkEncToAskarAlg
}

export function aeadEncrypt(options: {
  key: Key
  encryption: AskarSupportedEncryptionOptions
  data: Uint8Array
}) {
  const { key, encryption, data } = options

  const askarEncryptionAlgorithm = jwkEncToAskarAlg[encryption.algorithm]
  if (!askarEncryptionAlgorithm) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(`JWA encryption algorithm '${encryption.algorithm}'`, 'askar')
  }

  const encrypted = key.aeadEncrypt({
    message: data,
    aad: 'aad' in encryption ? encryption.aad : undefined,
    nonce: 'iv' in encryption ? encryption.iv : undefined,
  })

  return {
    encrypted: encrypted.ciphertext,
    iv: encrypted.nonce,
    tag: encrypted.tag,
  }
}
