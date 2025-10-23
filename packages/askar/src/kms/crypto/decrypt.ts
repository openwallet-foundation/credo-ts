import { type AnyUint8Array, Kms } from '@credo-ts/core'
import { Key } from '@openwallet-foundation/askar-shared'
import { jwkEncToAskarAlg } from '../../utils'

// TODO: should we make these methods generic, so they can be reused across backends?
type AskarSupportedDecryptionOptions = Kms.KmsDecryptDataDecryption & {
  algorithm: keyof typeof jwkEncToAskarAlg
}

export function aeadDecrypt(options: {
  key: Key
  decryption: AskarSupportedDecryptionOptions
  encrypted: AnyUint8Array
}) {
  const { key, decryption, encrypted } = options

  const askarEncryptionAlgorithm = jwkEncToAskarAlg[decryption.algorithm]
  if (!askarEncryptionAlgorithm) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(`JWA decryption algorithm '${decryption.algorithm}'`, 'askar')
  }

  const decrypted = key.aeadDecrypt({
    ciphertext: new Uint8Array(encrypted),
    tag: new Uint8Array(decryption.tag),
    aad: decryption.aad ? new Uint8Array(decryption.aad) : undefined,
    nonce: new Uint8Array(decryption.iv),
  })

  return new Uint8Array(decrypted)
}
