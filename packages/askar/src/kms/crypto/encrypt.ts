import { type AnyUint8Array, Kms } from '@credo-ts/core'
import { Key } from '@openwallet-foundation/askar-shared'
import { jwkEncToAskarAlg } from '../../utils'

export type AskarSupportedEncryptionOptions = Kms.KmsEncryptDataEncryption & {
  algorithm: keyof typeof jwkEncToAskarAlg
}

export function aeadEncrypt(options: {
  key: Key
  encryption: AskarSupportedEncryptionOptions
  data: AnyUint8Array
}) {
  const { key, encryption, data } = options

  const askarEncryptionAlgorithm = jwkEncToAskarAlg[encryption.algorithm]
  if (!askarEncryptionAlgorithm) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(`JWA encryption algorithm '${encryption.algorithm}'`, 'askar')
  }

  const encrypted = key.aeadEncrypt({
    message: new Uint8Array(data),
    aad: encryption.aad ? new Uint8Array(encryption.aad) : undefined,
    nonce: encryption.iv ? new Uint8Array(encryption.iv) : undefined,
  })

  return {
    encrypted: new Uint8Array(encrypted.ciphertext),
    iv: new Uint8Array(encrypted.nonce),
    tag: new Uint8Array(encrypted.tag),
  }
}
