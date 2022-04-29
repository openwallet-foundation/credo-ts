import type { Buffer } from '../utils'
import type { KeyPair, KeyType } from './types'

export interface CreateKeyParams {
  keyType?: KeyType
  seed?: string
}

export interface SignParams {
  payload: Buffer
  signKey: Buffer
  keyType?: KeyType
}

export interface VerifyParams {
  payload: Buffer
  signature: Buffer
  key: Buffer
  keyType?: KeyType
}

export interface AesEncryptParams {
  payload: Buffer
  senderPrivateKey: Buffer
  recipientPublicKey: Buffer
  keyType?: KeyType
}

export interface AesDecryptParams {
  payload: Buffer
  senderPublicKey: Buffer
  recipientPrivateKey: Buffer
  keyType?: KeyType
}

export interface Crypto {
  createKey(params: CreateKeyParams): Promise<KeyPair>
  sign(params: SignParams): Promise<Buffer>
  verify(params: VerifyParams): Promise<boolean>
  aesEncrypt(params: AesEncryptParams): Promise<Buffer>
  aesDecrypt(params: AesDecryptParams): Promise<Buffer>
}
