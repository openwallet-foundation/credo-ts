import { KeyManagementError } from '../error/KeyManagementError'
import { KmsJwkPrivate, KnownJwaSignatureAlgorithm, getJwkHumanDescription } from '../jwk'
import { KmsCreateKeyType } from './KmsCreateKeyOptions'
import { KmsDecryptDataDecryption } from './KmsDecryptOptions'
import { KmsEncryptDataEncryption } from './KmsEncryptOptions'
import { KmsKeyAgreementDecryptOptions } from './KmsKeyAgreementDecryptOptions'
import { KmsKeyAgreementEncryptOptions } from './KmsKeyAgreementEncryptOptions'

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

export type KmsOperationEncrypt = {
  operation: 'encrypt'
  encryption: KmsEncryptDataEncryption
  keyAgreement?: KmsKeyAgreementEncryptOptions
}

export type KmsOperationDecrypt = {
  operation: 'decrypt'
  decryption: KmsDecryptDataDecryption
  keyAgreement?: KmsKeyAgreementDecryptOptions
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

  if (operation.operation === 'encrypt') {
    let message = `'encrypt' operation with encryption algorithm '${operation.encryption.algorithm}'`
    if (operation.keyAgreement) {
      message += `and key agreement algorithm '${operation.keyAgreement.algorithm}'`
    }
    return message
  }

  if (operation.operation === 'decrypt') {
    let message = `'decrypt' operation with encryption algorithm '${operation.decryption.algorithm}'`
    if (operation.keyAgreement) {
      message += `and key agreement algorithm '${operation.keyAgreement.algorithm}'`
    }
    return message
  }

  if (operation.operation === 'randomBytes') {
    return `'randomBytes' operation`
  }

  throw new KeyManagementError('Unsupported operation')
}
