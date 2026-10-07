import type { Kms } from '@credo-ts/core'

// Kept apart from `utils.ts`: the public issuer options reference these types, so this module ends up in the published type declarations
/**
 * The `alg` values supported for response encryption (JARM and OpenID4VCI credential responses).
 * Keep in sync with the encrypt/decrypt jwe callbacks.
 */
export const supportedResponseEncryptionKeyAgreementAlgorithms = [
  'ECDH-ES',
] satisfies Kms.KnownJwaKeyAgreementAlgorithm[]

/**
 * The `enc` values supported for response encryption (JARM and OpenID4VCI credential responses).
 * Keep in sync with the encrypt/decrypt jwe callbacks.
 */
export const supportedResponseEncryptionContentAlgorithms = [
  'A128GCM',
  'A256GCM',
  'A128CBC-HS256',
] satisfies Kms.KnownJwaContentEncryptionAlgorithm[]
