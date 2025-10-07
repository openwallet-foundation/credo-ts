import { KeyManagementAlgorithmNotSupportedError } from '../error/KeyManagementAlgorithmNotSupportedError'
import {
  type KmsDecryptDataDecryption,
  type KmsEncryptDataEncryption,
  type KmsKeyAgreementDecryptOptions,
  type KmsKeyAgreementEncryptOptions,
} from '../options'
import {
  type KnownJwaContentEncryptionAlgorithm,
  type KnownJwaKeyAgreementAlgorithm,
  type KnownJwaKeyEncryptionAlgorithm,
} from './jwa'

export function assertSupportedKeyAgreementAlgorithm<
  KeyAgreement extends KmsKeyAgreementEncryptOptions | KmsKeyAgreementDecryptOptions,
  SupportedAlgorithms extends KnownJwaKeyAgreementAlgorithm[],
>(
  keyAgreement: KeyAgreement,
  supportedAlgorithms: SupportedAlgorithms,
  backend: string
): asserts keyAgreement is KeyAgreement & { algorithm: SupportedAlgorithms[number] } {
  if (!supportedAlgorithms.includes(keyAgreement.algorithm as (typeof supportedAlgorithms)[number])) {
    throw new KeyManagementAlgorithmNotSupportedError(
      `JWA key agreement algorithm '${keyAgreement.algorithm}'`,
      backend
    )
  }
}

export function assertSupportedEncryptionAlgorithm<
  Encryption extends KmsEncryptDataEncryption | KmsDecryptDataDecryption,
  SupportedAlgorithms extends Array<KnownJwaContentEncryptionAlgorithm | KnownJwaKeyEncryptionAlgorithm>,
>(
  encryption: Encryption,
  supportedAlgorithms: SupportedAlgorithms,
  backend: string
): asserts encryption is Encryption & { algorithm: SupportedAlgorithms[number] } {
  if (!supportedAlgorithms.includes(encryption.algorithm as (typeof supportedAlgorithms)[number])) {
    throw new KeyManagementAlgorithmNotSupportedError(`JWA encryption algorithm '${encryption.algorithm}'`, backend)
  }
}
