import type { Logger } from '../logger'
import type { WalletConfig, WalletConfigRekey, WalletExportImportConfig } from '../types'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../agent/AgentConfig'
import { InjectionSymbols } from '../constants'

import { Wallet } from './Wallet'
import { WalletError } from './error/WalletError'
import { WalletNotFoundError } from './error/WalletNotFoundError'

@scoped(Lifecycle.ContainerScoped)
export class WalletModule {
  private wallet: Wallet
  private logger: Logger

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet, agentConfig: AgentConfig) {
    this.wallet = wallet
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
        await this.createAndOpen(walletConfig)
      } else {
        throw error
      }
    }
  }

  public async createAndOpen(walletConfig: WalletConfig): Promise<void> {
    await this.wallet.createAndOpen(walletConfig)
  }

  public async create(walletConfig: WalletConfig): Promise<void> {
    await this.wallet.create(walletConfig)
  }

  public async open(walletConfig: WalletConfig): Promise<void> {
    await this.wallet.open(walletConfig)
  }

  public async close(): Promise<void> {
    await this.wallet.close()
  }

  public async rotateKey(walletConfig: WalletConfigRekey): Promise<void> {
    await this.wallet.rotateKey(walletConfig)
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
