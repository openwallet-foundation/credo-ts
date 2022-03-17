import type { KeyType, Key } from '../crypto'
import type { EncryptedMessage, DecryptedMessageContext, WalletConfig, WalletExportImportConfig } from '../types'
import type { Buffer } from '../utils/buffer'

export interface Wallet {
  publicDid: DidInfo | undefined
  isInitialized: boolean
  isProvisioned: boolean

  create(walletConfig: WalletConfig): Promise<void>
  createAndOpen(walletConfig: WalletConfig): Promise<void>
  open(walletConfig: WalletConfig): Promise<void>
  close(): Promise<void>
  delete(): Promise<void>
  export(exportConfig: WalletExportImportConfig): Promise<void>
  import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig): Promise<void>

  createKey(options: CreateKeyOptions): Promise<Key>
  sign(options: SignOptions): Promise<Buffer>
  verify(options: VerifyOptions): Promise<boolean>

  initPublicDid(didConfig: DidConfig): Promise<void>
  createDid(didConfig?: DidConfig): Promise<DidInfo>
  pack(payload: Record<string, unknown>, recipientKeys: string[], senderVerkey?: string): Promise<EncryptedMessage>
  unpack(encryptedMessage: EncryptedMessage): Promise<DecryptedMessageContext>
  generateNonce(): Promise<string>
}

export interface DidInfo {
  did: string
  verkey: string
}

export interface CreateKeyOptions {
  keyType: KeyType
  seed?: string
}

export interface SignOptions {
  data: Buffer
  key: Key
}

export interface VerifyOptions {
  data: Buffer
  key: Key
  signature: Buffer
}

export interface DidConfig {
  seed?: string
}
