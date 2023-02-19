import type { Key, KeyType } from '../crypto'
import type { Disposable } from '../plugins'
import type {
  EncryptedMessage,
  PlaintextMessage,
  WalletConfig,
  WalletConfigRekey,
  WalletExportImportConfig,
} from '../types'
import type { Buffer } from '../utils/buffer'

export interface Wallet extends Disposable {
  isInitialized: boolean
  isProvisioned: boolean

  create(walletConfig: WalletConfig): Promise<void>
  createAndOpen(walletConfig: WalletConfig): Promise<void>
  open(walletConfig: WalletConfig): Promise<void>
  rotateKey(walletConfig: WalletConfigRekey): Promise<void>
  close(): Promise<void>
  delete(): Promise<void>
  export(exportConfig: WalletExportImportConfig): Promise<void>
  import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig): Promise<void>

  createKey(options: WalletCreateKeyOptions): Promise<Key>
  sign(options: WalletSignOptions): Promise<Buffer>
  verify(options: WalletVerifyOptions): Promise<boolean>

  pack(payload: Record<string, unknown>, recipientKeys: string[], senderVerkey?: string): Promise<EncryptedMessage>
  unpack(encryptedMessage: EncryptedMessage): Promise<UnpackedMessageContext>
  generateNonce(): Promise<string>
  generateWalletKey(): Promise<string>
}

export interface WalletCreateKeyOptions {
  keyType: KeyType
  seed?: Buffer
  privateKey?: Buffer
}

export interface WalletSignOptions {
  data: Buffer | Buffer[]
  key: Key
}

export interface WalletVerifyOptions {
  data: Buffer | Buffer[]
  key: Key
  signature: Buffer
}

export interface UnpackedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: string
  recipientKey?: string
}
