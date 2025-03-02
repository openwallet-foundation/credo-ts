import type { WalletConfig, WalletConfigRekey, WalletExportImportConfig } from '../types'
import type { Wallet, WalletCreateKeyOptions } from './Wallet'

import { AgentContext } from '../agent'
import { InjectionSymbols } from '../constants'
import { Logger } from '../logger'
import { inject, injectable } from '../plugins'
import { StorageUpdateService } from '../storage'
import { CURRENT_FRAMEWORK_STORAGE_VERSION } from '../storage/migration/updates'

import { WalletError } from './error/WalletError'
import { WalletNotFoundError } from './error/WalletNotFoundError'

@injectable()
export class WalletApi {
  private agentContext: AgentContext
  private wallet: Wallet
  private storageUpdateService: StorageUpdateService
  private logger: Logger
  private _walletConfig?: WalletConfig

  public constructor(
    storageUpdateService: StorageUpdateService,
    agentContext: AgentContext,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.storageUpdateService = storageUpdateService
    this.logger = logger
    this.wallet = agentContext.wallet
    this.agentContext = agentContext
  }

  public get isInitialized() {
    return this.wallet.isInitialized
  }

  public get isProvisioned() {
    return this.wallet.isProvisioned
  }

  public get walletConfig() {
    return this._walletConfig
  }

  public async initialize(walletConfig: WalletConfig): Promise<void> {
    this.logger.info(`Initializing wallet '${walletConfig.id}'`, {
      ...walletConfig,
      key: walletConfig?.key ? '[*****]' : undefined,
      storage: {
        ...walletConfig?.storage,
        credentials: walletConfig?.storage?.credentials ? '[*****]' : undefined,
      },
    })

    if (this.isInitialized) {
      throw new WalletError(
        'Wallet instance already initialized. Close the currently opened wallet before re-initializing the wallet'
      )
    }

    // Open wallet, creating if it doesn't exist yet
    try {
      await this.open(walletConfig)
    } catch (error) {
      // If the wallet does not exist yet, create it and try to open again
      if (error instanceof WalletNotFoundError) {
        // Keep the wallet open after creating it, this saves an extra round trip of closing/opening
        // the wallet, which can save quite some time.
        await this.createAndOpen(walletConfig)
      } else {
        throw error
      }
    }
  }

  public async createAndOpen(walletConfig: WalletConfig): Promise<void> {
    // Always keep the wallet open, as we still need to store the storage version in the wallet.
    await this.wallet.createAndOpen(walletConfig)

    this._walletConfig = walletConfig

    // Store the storage version in the wallet
    await this.storageUpdateService.setCurrentStorageVersion(this.agentContext, CURRENT_FRAMEWORK_STORAGE_VERSION)
  }

  public async create(walletConfig: WalletConfig): Promise<void> {
    await this.createAndOpen(walletConfig)
    await this.close()
  }

  public async open(walletConfig: WalletConfig): Promise<void> {
    await this.wallet.open(walletConfig)
    this._walletConfig = walletConfig
  }

  public async close(): Promise<void> {
    await this.wallet.close()
  }

  public async rotateKey(walletConfig: WalletConfigRekey): Promise<void> {
    await this.wallet.rotateKey(walletConfig)
  }

  public async generateNonce(): Promise<string> {
    return await this.wallet.generateNonce()
  }

  public async delete(): Promise<void> {
    await this.wallet.delete()
  }

  public async export(exportConfig: WalletExportImportConfig): Promise<void> {
    await this.wallet.export(exportConfig)
  }

  public async import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig): Promise<void> {
    await this.wallet.import(walletConfig, importConfig)
  }

  /**
   * Create a key for and store it in the wallet. You can optionally provide a `privateKey`
   * or `seed` for deterministic key generation.
   *
   * @param privateKey Buffer Private key (formerly called 'seed')
   * @param seed Buffer  (formerly called 'seed')
   * @param keyType KeyType the type of key that should be created
   *
   * @returns a `Key` instance
   *
   * @throws {WalletError} When an unsupported `KeyType` is provided
   * @throws {WalletError} When the key could not be created
   */
  public async createKey(options: WalletCreateKeyOptions) {
    return this.wallet.createKey(options)
  }
}
