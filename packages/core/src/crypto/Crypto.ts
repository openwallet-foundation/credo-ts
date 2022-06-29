import type { Buffer } from '../utils'
import type { KeyPair, KeyType } from './types'

export interface CreateKeyParams {
  keyType?: KeyType
  seed?: string
}

export interface SignParams {
  payload: Buffer
  verKey: Buffer
  signKey: Buffer
  keyType?: KeyType
}

export interface VerifyParams {
  payload: Buffer
  signature: Buffer
  key: Buffer
  keyType?: KeyType
}

export interface EncryptParams {
  payload: Buffer
  senderPublicKey: Buffer
  senderPrivateKey: Buffer
  recipientPublicKey: Buffer
  keyType?: KeyType
}

export interface DecryptParams {
  payload: Buffer
  senderPublicKey: Buffer
  recipientPublicKey: Buffer
  recipientPrivateKey: Buffer
  keyType?: KeyType
}

export interface Crypto {
  createKey(params: CreateKeyParams): Promise<KeyPair>
  sign(params: SignParams): Promise<Buffer>
  verify(params: VerifyParams): Promise<boolean>
  encrypt(params: EncryptParams): Promise<Buffer>
  decrypt(params: DecryptParams): Promise<Buffer>
  convertEd25519ToX25519Key(keyPair: KeyPair): Promise<KeyPair>
}
