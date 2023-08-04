/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Wallet, KeyPair, WalletPackOptions } from '../../src'
import type { Key } from '../../src/crypto'
import type { EncryptedMessage } from '../../src/didcomm/types'
import type { WalletConfig, WalletExportImportConfig, WalletConfigRekey } from '../../src/types'
import type { Buffer } from '../../src/utils/buffer'
import type {
  UnpackedMessageContext,
  WalletCreateKeyOptions,
  WalletSignOptions,
  WalletVerifyOptions,
} from '../../src/wallet'

export class MockWallet implements Wallet {
  public isInitialized = true
  public isProvisioned = true

  public supportedKeyTypes = []

  public create(walletConfig: WalletConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public createAndOpen(walletConfig: WalletConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public open(walletConfig: WalletConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public rotateKey(walletConfig: WalletConfigRekey): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public close(): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public delete(): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public export(exportConfig: WalletExportImportConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public pack(payload: Record<string, unknown>, params: WalletPackOptions): Promise<EncryptedMessage> {
    throw new Error('Method not implemented.')
  }
  public unpack(encryptedMessage: EncryptedMessage): Promise<UnpackedMessageContext> {
    throw new Error('Method not implemented.')
  }
  public sign(options: WalletSignOptions): Promise<Buffer> {
    throw new Error('Method not implemented.')
  }
  public verify(options: WalletVerifyOptions): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  public createKey(options: WalletCreateKeyOptions): Promise<Key> {
    throw new Error('Method not implemented.')
  }

  public generateNonce(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  public generateWalletKey(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  public dispose() {
    // Nothing to do here
  }
}
