import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { AskarModuleConfigOptions } from './AskarModuleConfig'

import { AgentConfig, CredoError, InjectionSymbols, Kms } from '@credo-ts/core'

import { AskarApi } from './AskarApi'
import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from './AskarModuleConfig'
import { AskarStoreManager } from './AskarStoreManager'
import { AksarKeyManagementService } from './kms/AskarKeyManagementService'
import { AskarStorageService } from './storage'

export class AskarModule implements Module {
  public readonly config: AskarModuleConfig

  public constructor(config: AskarModuleConfigOptions) {
    this.config = new AskarModuleConfig(config)
  }

  public api = AskarApi

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(AskarModuleConfig, this.config)

    if (!this.config.enableKms && !this.config.enableStorage) {
      dependencyManager
        .resolve(AgentConfig)
        .logger.warn(`Both 'enableKms' and 'enableStorage' are disabled, meaning Askar won't be used by the agent.`)
    }

    if (this.config.enableKms) {
      const kmsConfig = dependencyManager.resolve(Kms.KeyManagementModuleConfig)
      kmsConfig.registerBackend(new AksarKeyManagementService())
    }

    if (this.config.enableStorage) {
      if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
        throw new CredoError(
          'Unable to register AskatStoreService. There is an instance of StorageService already registered'
        )
      }
      dependencyManager.registerSingleton(InjectionSymbols.StorageService, AskarStorageService)
    }

    dependencyManager.registerSingleton(AskarStoreManager)
  }

  public async onInitializeContext(agentContext: AgentContext, metadata: Record<string, unknown>) {
    // TODO: I think we should also register the store here
    if (agentContext.contextCorrelationId === 'default') {
      const storeManager = agentContext.dependencyManager.resolve(AskarStoreManager)
      await storeManager.getInitializedStoreWithProfile(agentContext)
      return
    }

    if (this.config.multiWalletDatabaseScheme === AskarMultiWalletDatabaseScheme.DatabasePerWallet) {
      agentContext.dependencyManager.registerInstance('AskarContextMetadata', metadata)
      const storeManager = agentContext.dependencyManager.resolve(AskarStoreManager)
      await storeManager.getInitializedStoreWithProfile(agentContext)
    }
  }

  public async onProvisionContext(agentContext: AgentContext) {
    // We don't have any side effects to run
    if (agentContext.contextCorrelationId === 'default') return null
    if (this.config.multiWalletDatabaseScheme === AskarMultiWalletDatabaseScheme.ProfilePerWallet) return null

    // For new stores (so not profiles) we need to generate a wallet key
    return {
      walletKey: this.config.askar.storeGenerateRawKey({}),
    }
  }

  public async onDeleteContext(agentContext: AgentContext) {
    const storeManager = agentContext.dependencyManager.resolve(AskarStoreManager)

    // Will delete either the store (when root agent context or database per wallet) or profile (when not root agent context and profile per wallet)
    await storeManager.deleteContext(agentContext)
  }

  public async onCloseContext(agentContext: AgentContext): Promise<void> {
    const storeManager = agentContext.dependencyManager.resolve(AskarStoreManager)

    await storeManager.closeContext(agentContext)
  }
}
