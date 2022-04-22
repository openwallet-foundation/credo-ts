export enum KeyType {
  Ed25519 = 'Ed25519',
  Secp256k1 = 'Secp256k1',
  X25519 = 'X25519',
}

export type CreateKeyParams = {
  keyType?: KeyType
}

export type KeyPair = {
  privateKey: Uint8Array
  publicKey: Uint8Array
}

export interface KeyManager {
  createKey(params: CreateKeyParams): Promise<KeyPair>
}
