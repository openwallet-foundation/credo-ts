import type { Logger } from '../logger'
import type { WalletConfig, WalletExportImportConfig } from '../types'
import type { WalletCreateConfig } from './Wallet'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../agent/AgentConfig'
import { InjectionSymbols } from '../constants'
import { StorageUpgradeService } from '../storage'

import { Wallet } from './Wallet'
import { WalletError } from './error/WalletError'
import { WalletNotFoundError } from './error/WalletNotFoundError'

@scoped(Lifecycle.ContainerScoped)
export class WalletModule {
  private wallet: Wallet
  private storageUpgradeService: StorageUpgradeService
  private logger: Logger

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    storageUpgradeService: StorageUpgradeService,
    agentConfig: AgentConfig
  ) {
    this.wallet = wallet
    this.storageUpgradeService = storageUpgradeService
    this.logger = agentConfig.logger
  }

  public get isInitialized() {
    return this.wallet.isInitialized
  }

  public get isProvisioned() {
    return this.wallet.isProvisioned
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
        await this.create({ ...walletConfig, keepOpenAfterCreate: true })
      } else {
        throw error
      }
    }
  }

  public async create(walletConfig: WalletCreateConfig): Promise<void> {
    // Close wallet by default after creating it
    const keepOpenAfterCreate = walletConfig.keepOpenAfterCreate ?? false

    // Always keep the wallet open, as we still need to store the storage version in the wallet.
    await this.wallet.create({ ...walletConfig, keepOpenAfterCreate: true })

    // Store the storage version in the wallet
    await this.storageUpgradeService.setCurrentStorageVersion(this.storageUpgradeService.frameworkStorageVersion)

    // We kept wallet open just to store some initial data in it, closing if desired
    if (!keepOpenAfterCreate) {
      await this.wallet.close()
    }
  }

  public async open(walletConfig: WalletConfig): Promise<void> {
    await this.wallet.open(walletConfig)
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
