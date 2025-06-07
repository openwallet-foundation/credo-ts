import { Kms } from '@credo-ts/core'
import { Key } from '@openwallet-foundation/askar-shared'
import { jwkEncToAskarAlg } from '../../utils'

// TODO: should we make these methods generic, so they can be reused across backends?
type AskarSupportedDecryptionOptions = Kms.KmsDecryptDataDecryption & {
  algorithm: keyof typeof jwkEncToAskarAlg
}

export function aeadDecrypt(options: {
  key: Key
  decryption: AskarSupportedDecryptionOptions
  encrypted: Uint8Array
}) {
  const { key, decryption, encrypted } = options

  const askarEncryptionAlgorithm = jwkEncToAskarAlg[decryption.algorithm]
  if (!askarEncryptionAlgorithm) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(`JWA decryption algorithm '${decryption.algorithm}'`, 'askar')
  }

  const decrypted = key.aeadDecrypt({
    ciphertext: encrypted,
    tag: decryption.tag,
    aad: decryption.aad,
    nonce: decryption.iv,
  })

  return decrypted
}
