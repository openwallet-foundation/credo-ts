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
}

export enum DidCommV2KeyProtectionAlgs {
  EcdhEsA128Kw = 'ECDH-ES+A128KW',
  EcdhEsA256Kw = 'ECDH-ES+A256KW',
  Ecdh1PuA128Kw = 'ECDH-1PU+A128KW',
  Ecdh1PuA256Kw = 'ECDH-1PU+A256KW',
}
