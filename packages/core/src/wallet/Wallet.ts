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
  /**
   * @deprecated The public did functionality of the wallet has been deprecated in favour of the DidsModule, which can be
   * used to create and resolve dids. Currently the global agent public did functionality is still used by the `LedgerModule`, but
   * will be removed once the `LedgerModule` has been deprecated. Do not use this property for new functionality, but rather
   * use the `DidsModule`.
   */
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

  createKey(options: WalletCreateKeyOptions): Promise<Key>
  sign(options: WalletSignOptions): Promise<Buffer>
  verify(options: WalletVerifyOptions): Promise<boolean>

  /**
   * @deprecated The public did functionality of the wallet has been deprecated in favour of the DidsModule, which can be
   * used to create and resolve dids. Currently the global agent public did functionality is still used by the `LedgerModule`, but
   * will be removed once the `LedgerModule` has been deprecated. Do not use this property for new functionality, but rather
   * use the `DidsModule`.
   */
  initPublicDid(didConfig: DidConfig): Promise<void>

  pack(payload: Record<string, unknown>, recipientKeys: string[], senderVerkey?: string): Promise<EncryptedMessage>
  unpack(encryptedMessage: EncryptedMessage): Promise<UnpackedMessageContext>
  generateNonce(): Promise<string>
  generateWalletKey(): Promise<string>
}

export interface DidInfo {
  did: string
  verkey: string
}

export interface WalletCreateKeyOptions {
  keyType: KeyType
  seed?: string
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

export interface DidConfig {
  seed?: string
}

export interface UnpackedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: string
  recipientKey?: string
}
