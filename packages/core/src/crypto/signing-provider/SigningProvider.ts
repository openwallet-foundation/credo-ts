import type { Buffer } from '../../utils/buffer'
import type { KeyType } from '../KeyType'

export interface KeyPair {
  publicKeyBase58: string
  privateKeyBase58: string
  keyType: KeyType
}

export interface SignOptions {
  data: Buffer | Buffer[]
  publicKeyBase58: string
  privateKeyBase58: string
}

export interface VerifyOptions {
  data: Buffer | Buffer[]
  publicKeyBase58: string
  signature: Buffer
}

export interface CreateKeyPairOptions {
  seed?: Buffer
  privateKey?: Buffer
}

export interface SigningProvider {
  readonly keyType: KeyType

  createKeyPair(options: CreateKeyPairOptions): Promise<KeyPair>
  sign(options: SignOptions): Promise<Buffer>
  verify(options: VerifyOptions): Promise<boolean>
}
