export interface PlaintextDidCommV2Message {
  type: string
  id: string
  from?: string
  to?: string[]

  [key: string]: unknown
}

export enum DidCommV2Types {
  EncryptedJson = 'application/didcomm-encrypted+json',
}

export enum DidCommV2EncryptionAlgs {
  XC20P = 'XC20P',
  A256CbcHs512 = 'A256CBC-HS512',
  A256Gcm = 'A256GCM',
}

export enum DidCommV2KeyProtectionAlgs {
  EcdhEsA128Kw = 'ECDH-ES+A128KW',
  EcdhEsA256Kw = 'ECDH-ES+A256KW',
  Ecdh1PuA128Kw = 'ECDH-1PU+A128KW',
  Ecdh1PuA256Kw = 'ECDH-1PU+A256KW',
}

export const AnoncrypDidCommV2EncryptionAlgs = [
  DidCommV2EncryptionAlgs.A256Gcm,
  DidCommV2EncryptionAlgs.XC20P,
  DidCommV2EncryptionAlgs.A256CbcHs512,
]
export const AuthcryptDidCommV2EncryptionAlgs = [DidCommV2EncryptionAlgs.A256CbcHs512]

export const AnoncrypDidCommV2KeyWrapAlgs = [
  DidCommV2KeyProtectionAlgs.EcdhEsA128Kw,
  DidCommV2KeyProtectionAlgs.EcdhEsA256Kw,
]
export const AuthcryptDidCommV2KeyWrapAlgs = [
  DidCommV2KeyProtectionAlgs.Ecdh1PuA128Kw,
  DidCommV2KeyProtectionAlgs.Ecdh1PuA256Kw,
]
