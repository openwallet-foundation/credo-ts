import type { Key, KeyType } from '../crypto'
import type { EncryptedMessage, PlaintextMessage, EnvelopeType, DidCommMessageVersion } from '../didcomm/types'
import type { DidDocument } from '../modules/dids/domain/DidDocument'
import type { Disposable } from '../plugins'
import type { WalletConfig, WalletConfigRekey, WalletExportImportConfig } from '../types'
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

  /**
   * Pack a message using DIDComm V1 or DIDComm V2 encryption algorithms
   *
   * @param payload message to pack
   * @param params Additional parameter to pack JWE (specific for didcomm version)
   *
   * @returns JWE Envelope to send
   */
  pack(payload: Record<string, unknown>, params: WalletPackOptions): Promise<EncryptedMessage>

  /**
   * Unpacks a JWE Envelope coded using DIDComm V1 of DIDComm V2 encryption algorithms
   *
   * @param encryptedMessage packed Json Web Envelope
   * @param params Additional parameter to unpack JWE (specific for didcomm version)
   *
   * @returns UnpackedMessageContext with plain text message, sender key, recipient key, and didcomm message version
   */
  unpack(encryptedMessage: EncryptedMessage, params?: WalletUnpackOptions): Promise<UnpackedMessageContext>

  generateNonce(): Promise<string>
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
  didCommVersion: DidCommMessageVersion
  plaintextMessage: PlaintextMessage
  senderKey?: Key
  recipientKey?: Key
}

export type WalletPackOptions = WalletPackV1Options | WalletPackV2Options

export type WalletPackV1Options = {
  didCommVersion: DidCommMessageVersion
  recipientKeys: Key[]
  senderKey?: Key | null
  envelopeType?: EnvelopeType
}

export type WalletPackV2Options = {
  didCommVersion: DidCommMessageVersion
  recipientDidDocuments: DidDocument[]
  senderDidDocument?: DidDocument | null
  envelopeType?: EnvelopeType
}

export type WalletUnpackOptions = {
  recipientDidDocuments: DidDocument[]
  senderDidDocument?: DidDocument | null
}
