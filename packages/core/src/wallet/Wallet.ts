import type {
  EncryptedMessage,
  WalletConfig,
  WalletExportImportConfig,
  WalletConfigRekey,
  PlaintextMessage,
} from '../types'
import type { Buffer } from '../utils/buffer'

export interface Wallet {
  publicDid: DidInfo | undefined
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

  initPublicDid(didConfig: DidConfig): Promise<void>
  createDid(didConfig?: DidConfig): Promise<DidInfo>
  pack(payload: Record<string, unknown>, recipientKeys: string[], senderVerkey?: string): Promise<EncryptedMessage>
  unpack(encryptedMessage: EncryptedMessage): Promise<UnpackedMessageContext>
  sign(data: Buffer, verkey: string): Promise<Buffer>
  verify(signerVerkey: string, data: Buffer, signature: Buffer): Promise<boolean>
  generateNonce(): Promise<string>
}

export interface DidInfo {
  did: string
  verkey: string
}

export interface DidConfig {
  seed?: string
}

export interface UnpackedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: string
  recipientKey?: string
}
