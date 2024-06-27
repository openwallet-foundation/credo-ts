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

// Split up into WalletManager and Wallet instance
// WalletManager is responsible for:
//  - create, open, delete, close, export, import
// Wallet is responsible for:
//  - createKey, sign, verify, pack, unpack, generateNonce, generateWalletKey

// - Split storage initialization from wallet initialization, as storage and wallet are not required to be the same
//     - wallet handles key management, signing, and encryption
//     - storage handles record storage and retrieval

export interface Wallet extends Disposable {
  isInitialized: boolean
  isProvisioned: boolean

  create(walletConfig: WalletConfig): Promise<void>
  createAndOpen(walletConfig: WalletConfig): Promise<void>
  open(walletConfig: WalletConfig): Promise<void>
  rotateKey(walletConfig: WalletConfigRekey): Promise<void>
  close(): Promise<void>
  delete(): Promise<void>

  /**
   * Export the wallet to a file at the given path and encrypt it with the given key.
   *
   * @throws {WalletExportPathExistsError} When the export path already exists
   */
  export(exportConfig: WalletExportImportConfig): Promise<void>
  import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig): Promise<void>

  /**
   * Create a key with an optional private key and keyType.
   *
   * @param options.privateKey Buffer Private key (formerly called 'seed')
   * @param options.keyType KeyType the type of key that should be created
   *
   * @returns a `Key` instance
   *
   * @throws {WalletError} When an unsupported keytype is requested
   * @throws {WalletError} When the key could not be created
   * @throws {WalletKeyExistsError} When the key already exists in the wallet
   */
  createKey(options: WalletCreateKeyOptions): Promise<Key>
  sign(options: WalletSignOptions): Promise<Buffer>
  verify(options: WalletVerifyOptions): Promise<boolean>

  pack(payload: Record<string, unknown>, recipientKeys: string[], senderVerkey?: string): Promise<EncryptedMessage>
  unpack(encryptedMessage: EncryptedMessage): Promise<UnpackedMessageContext>
  generateNonce(): Promise<string>
  getRandomValues(length: number): Uint8Array
  generateWalletKey(): Promise<string>

  /**
   * Get the key types supported by the wallet implementation.
   */
  supportedKeyTypes: KeyType[]
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
