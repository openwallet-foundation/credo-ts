/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Wallet } from '../../src'
import type { Key } from '../../src/crypto'
import type { EncryptedMessage, WalletConfig, WalletExportImportConfig, WalletConfigRekey } from '../../src/types'
import type { Buffer } from '../../src/utils/buffer'
import type {
  DidInfo,
  UnpackedMessageContext,
  DidConfig,
  CreateKeyOptions,
  SignOptions,
  VerifyOptions,
} from '../../src/wallet'

export class MockWallet implements Wallet {
  public publicDid = undefined
  public isInitialized = true
  public isProvisioned = true

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
  public initPublicDid(didConfig: DidConfig): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public createDid(didConfig?: DidConfig): Promise<DidInfo> {
    throw new Error('Method not implemented.')
  }
  public pack(
    payload: Record<string, unknown>,
    recipientKeys: string[],
    senderVerkey?: string
  ): Promise<EncryptedMessage> {
    throw new Error('Method not implemented.')
  }
  public unpack(encryptedMessage: EncryptedMessage): Promise<UnpackedMessageContext> {
    throw new Error('Method not implemented.')
  }
  public sign(options: SignOptions): Promise<Buffer> {
    throw new Error('Method not implemented.')
  }
  public verify(options: VerifyOptions): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  public createKey(options: CreateKeyOptions): Promise<Key> {
    throw new Error('Method not implemented.')
  }

  public generateNonce(): Promise<string> {
    throw new Error('Method not implemented.')
  }
}
