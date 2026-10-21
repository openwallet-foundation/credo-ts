import { KeyManagementError } from '../error/KeyManagementError'
import { getJwkHumanDescription, type KmsJwkPrivate, type KnownJwaSignatureAlgorithm } from '../jwk'
import type { KmsCreateKeyType } from './KmsCreateKeyOptions'
import type { KmsDecryptDataDecryption } from './KmsDecryptOptions'
import type { KmsEncryptDataEncryption } from './KmsEncryptOptions'
import type { KmsKeyAgreementDecryptOptions } from './KmsKeyAgreementDecryptOptions'
import type { KmsJwkPublicEcdh, KmsKeyAgreementEncryptOptions } from './KmsKeyAgreementEncryptOptions'

export type KmsOperationCreateKey = {
  operation: 'createKey'
  type: KmsCreateKeyType
}

export type KmsOperationImportKey = {
  operation: 'importKey'
  privateJwk: KmsJwkPrivate
}

export type KmsOperationDeleteKey = {
  operation: 'deleteKey'
}

export type KmsOperationSign = {
  operation: 'sign'
  algorithm: KnownJwaSignatureAlgorithm
}

export type KmsOperationVerify = {
  operation: 'verify'
  algorithm: KnownJwaSignatureAlgorithm
}

/**
 * The key id is not needed to determine whether an operation is supported, and is
 * often not known yet when checking for support.
 */
type WithOptionalKeyId<Options> = Options extends { keyId: string }
  ? Omit<Options, 'keyId'> & { keyId?: string }
  : Options

export type KmsOperationEncrypt = {
  operation: 'encrypt'
  /**
   * `HPKE` for the integrated-encryption HPKE algorithms, where the suite fixes the AEAD.
   */
  encryption: KmsEncryptDataEncryption
  keyAgreement?: WithOptionalKeyId<KmsKeyAgreementEncryptOptions>
}

export type KmsOperationDecrypt = {
  operation: 'decrypt'
  /**
   * `HPKE` for the integrated-encryption HPKE algorithms, where the suite fixes the AEAD.
   */
  decryption: KmsDecryptDataDecryption
  keyAgreement?: WithOptionalKeyId<KmsKeyAgreementDecryptOptions>
}

/**
 * The public keys in a key agreement: the recipients on encrypt, the sender's ephemeral and static keys on decrypt.
 */
export function keyAgreementPublicJwks(
  keyAgreement: NonNullable<KmsOperationEncrypt['keyAgreement'] | KmsOperationDecrypt['keyAgreement']>
): KmsJwkPublicEcdh[] {
  if ('recipients' in keyAgreement) return keyAgreement.recipients.map(({ externalPublicJwk }) => externalPublicJwk)

  return [
    'externalPublicJwk' in keyAgreement ? keyAgreement.externalPublicJwk : undefined,
    'ephemeralPublicJwk' in keyAgreement ? keyAgreement.ephemeralPublicJwk : undefined,
    'senderPublicJwk' in keyAgreement ? keyAgreement.senderPublicJwk : undefined,
  ].filter((jwk) => jwk !== undefined)
}

export type KmsOperationRandomBytes = {
  operation: 'randomBytes'
}

export type KmsOperation =
  | KmsOperationCreateKey
  | KmsOperationImportKey
  | KmsOperationDeleteKey
  | KmsOperationSign
  | KmsOperationVerify
  | KmsOperationEncrypt
  | KmsOperationDecrypt
  | KmsOperationRandomBytes

export function getKmsOperationHumanDescription(operation: KmsOperation) {
  if (operation.operation === 'deleteKey') {
    return "'deleteKey' operation"
  }

  if (operation.operation === 'createKey') {
    let base = `'createKey' operation with kty '${operation.type.kty}'`

    if (operation.type.kty === 'EC' || operation.type.kty === 'OKP') {
      base += ` and crv '${operation.type.crv}'`
    } else if (operation.type.kty === 'RSA') {
      base += ` and bit length '${operation.type.modulusLength}'`
    } else if (operation.type.kty === 'oct') {
      base += ` and algorithm '${operation.type.algorithm}'`

      if (operation.type.algorithm === 'aes' || operation.type.algorithm === 'hmac') {
        base += ` with key length '${operation.type.length}'`
      }
    }

    return base
  }

  if (operation.operation === 'importKey') {
    return `'importKey' operation with ${getJwkHumanDescription(operation.privateJwk)}`
  }

  if (operation.operation === 'sign' || operation.operation === 'verify') {
    return `'${operation.operation}' operation with algorithm '${operation.algorithm}'`
  }

  if (operation.operation === 'encrypt' || operation.operation === 'decrypt') {
    const encryption = operation.operation === 'encrypt' ? operation.encryption : operation.decryption

    let message = `'${operation.operation}' operation with encryption algorithm '${encryption.algorithm}'`
    if (operation.keyAgreement) {
      message += ` and key agreement algorithm '${operation.keyAgreement.algorithm}'`
    }
    return message
  }

  if (operation.operation === 'randomBytes') {
    return `'randomBytes' operation`
  }

  throw new KeyManagementError('Unsupported operation')
}
