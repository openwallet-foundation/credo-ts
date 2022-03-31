import type { Logger } from '../logger'
import type { WalletConfig, WalletExportImportConfig } from '../types'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../agent/AgentConfig'
import { InjectionSymbols } from '../constants'
import { StorageUpdateService } from '../storage'
import { CURRENT_FRAMEWORK_STORAGE_VERSION } from '../storage/migration/updates'

import { Wallet } from './Wallet'
import { WalletError } from './error/WalletError'
import { WalletNotFoundError } from './error/WalletNotFoundError'

@scoped(Lifecycle.ContainerScoped)
export class WalletModule {
  private wallet: Wallet
  private storageUpdateService: StorageUpdateService
  private logger: Logger
  private _walletConfig?: WalletConfig

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    storageUpdateService: StorageUpdateService,
    agentConfig: AgentConfig
  ) {
    this.wallet = wallet
    this.storageUpdateService = storageUpdateService
    this.logger = agentConfig.logger
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
    this.logger.info(`Initializing wallet '${walletConfig.id}'`, walletConfig)

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
    await this.storageUpdateService.setCurrentStorageVersion(CURRENT_FRAMEWORK_STORAGE_VERSION)
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

  public async delete(): Promise<void> {
    await this.wallet.delete()
  }

  public async export(exportConfig: WalletExportImportConfig): Promise<void> {
    await this.wallet.export(exportConfig)
  }

  public async import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig): Promise<void> {
    await this.wallet.import(walletConfig, importConfig)
  }
}
