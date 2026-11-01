import type { PublicJwk } from '../modules/kms'

export type JweEcdhContentEncryptionAlgorithm =
  | 'A128CBC-HS256'
  | 'A192CBC-HS384'
  | 'A256CBC-HS512'
  | 'A128GCM'
  | 'A192GCM'
  | 'A256GCM'
  | 'C20P'
  | 'XC20P'

export interface JweRecipientOptions {
  publicJwk: PublicJwk
  header?: Record<string, unknown>
}

export type JweKeyAgreementEncryptOptions =
  | {
      algorithm: 'ECDH-ES'
      recipient: JweRecipientOptions
    }
  | {
      algorithm: 'ECDH-ES+A128KW' | 'ECDH-ES+A192KW' | 'ECDH-ES+A256KW'
      recipients: JweRecipientOptions[]
    }
  | {
      algorithm: 'ECDH-1PU+A256KW'
      senderKeyId: string
      recipients: JweRecipientOptions[]
    }

export interface JweEncryptOptions {
  keyAgreement: JweKeyAgreementEncryptOptions
  enc: JweEcdhContentEncryptionAlgorithm
  apu?: Uint8Array
  apv?: Uint8Array
  protectedHeaderOptions?: Record<string, unknown>
  data: Uint8Array
}

export interface JweGeneralJson {
  protected: string
  unprotected?: Record<string, unknown>
  recipients?: Array<{ header?: Record<string, unknown>; encrypted_key?: string }>
  aad?: string
  iv: string
  ciphertext: string
  tag: string
}

export interface JweDecryptOptions {
  jwe: string | JweGeneralJson
  recipientKeyId: string
  recipientKid?: string
  senderPublicJwk?: PublicJwk
  allowedKeyAgreementAlgorithms?: JweKeyAgreementEncryptOptions['algorithm'][]
  allowedContentEncryptionAlgorithms?: JweEcdhContentEncryptionAlgorithm[]
}

export interface JweDecryptResult {
  data: Uint8Array
  protectedHeader: Record<string, unknown>
  recipientHeader?: Record<string, unknown>
}
