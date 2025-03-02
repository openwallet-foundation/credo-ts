import type { Wallet } from '../../src'
import type { Key } from '../../src/crypto'
import type { EncryptedMessage, WalletConfig, WalletConfigRekey, WalletExportImportConfig } from '../../src/types'
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

  public create(_walletConfig: WalletConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public createAndOpen(_walletConfig: WalletConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public open(_walletConfig: WalletConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public rotateKey(_walletConfig: WalletConfigRekey): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public close(): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public delete(): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public export(_exportConfig: WalletExportImportConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public import(_walletConfig: WalletConfig, _importConfig: WalletExportImportConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public pack(
    _payload: Record<string, unknown>,
    _recipientKeys: string[],
    _senderVerkey?: string
  ): Promise<EncryptedMessage> {
    throw new Error('Method not implemented.')
  }
  public unpack(_encryptedMessage: EncryptedMessage): Promise<UnpackedMessageContext> {
    throw new Error('Method not implemented.')
  }
  public sign(_options: WalletSignOptions): Promise<Buffer> {
    throw new Error('Method not implemented.')
  }
  public verify(_options: WalletVerifyOptions): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  public createKey(_options: WalletCreateKeyOptions): Promise<Key> {
    throw new Error('Method not implemented.')
  }

  public generateNonce(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  public getRandomValues(_length: number): Uint8Array {
    throw new Error('Method not implemented.')
  }

  public generateWalletKey(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  public dispose() {
    // Nothing to do here
  }
}
