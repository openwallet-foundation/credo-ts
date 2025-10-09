import type { Key, KeyType } from '../crypto'
import type { KeyBackend } from '../crypto/KeyBackend'
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

  // Methods to faciliate OpenID4VP response encryption, should be unified/generalized at some
  // point. Ideally all the didcomm/oid4vc/encryption/decryption is generalized, but it's a bit complex
  // @note methods are optional to not introduce breaking changes

  /**
   * Method that enables JWT encryption using ECDH-ES and AesA256Gcm and returns it as a compact JWE.
   * This method is specifically added to support OpenID4VP response encryption using JARM and should later be
   * refactored into a more generic method that supports encryption/decryption.
   *
   * @returns compact JWE
   */
  directEncryptCompactJweEcdhEs?(options: WalletDirectEncryptCompactJwtEcdhEsOptions): Promise<string>

  /**
   * Method that enabled JWT encryption using ECDH-ES and AesA256Gcm and returns it as a compact JWE.
   * This method is specifically added to support OpenID4VP response encryption using JARM and should later be
   * refactored into a more generic method that supports encryption/decryption.
   *
   * @returns compact JWE
   */
  directDecryptCompactJweEcdhEs?({
    compactJwe,
    recipientKey,
  }: {
    compactJwe: string
    recipientKey: Key
  }): Promise<WalletDirectDecryptCompactJwtEcdhEsReturn>

  /**
   * Get the key types supported by the wallet implementation.
   */
  supportedKeyTypes: KeyType[]
}

export interface WalletCreateKeyOptions {
  keyType: KeyType
  seed?: Buffer
  privateKey?: Buffer
  keyBackend?: KeyBackend
  keyId?: string
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

export interface WalletDirectEncryptCompactJwtEcdhEsOptions {
  recipientKey: Key
  encryptionAlgorithm: 'A256GCM'
  apu?: string
  apv?: string
  data: Buffer
  header: Record<string, unknown>
}

export interface WalletDirectDecryptCompactJwtEcdhEsReturn {
  data: Buffer
  header: Record<string, unknown>
}
