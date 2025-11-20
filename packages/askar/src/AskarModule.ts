import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import { AgentConfig, CredoError, InjectionSymbols, Kms } from '@credo-ts/core'
import { AskarApi } from './AskarApi'
import type { AskarModuleConfigOptions } from './AskarModuleConfig'
import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from './AskarModuleConfig'
import { AskarStoreManager } from './AskarStoreManager'
import { AskarKeyManagementService } from './kms/AskarKeyManagementService'
import { AskarStorageService } from './storage'
import { storeAskarStoreConfigForContextCorrelationId } from './tenants'

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
      if (kmsConfig.backends.find((backend) => backend.backend === AskarKeyManagementService.backend)) {
        throw new CredoError(
          `Unable to register AskarKeyManagementService. There is a key management backend with name '${AskarKeyManagementService.backend}' already registered. If you have manually registered the AskarKeyManagementService on the KeyManagementModule, set 'enableKms' to false in the AskarModule.`
        )
      }

      kmsConfig.registerBackend(new AskarKeyManagementService())
    }

    if (this.config.enableStorage) {
      if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
        throw new CredoError(
          'Unable to register AskarStorageService. There is an instance of StorageService already registered'
        )
      }
      dependencyManager.registerSingleton(InjectionSymbols.StorageService, AskarStorageService)
    }

    dependencyManager.registerSingleton(AskarStoreManager)
  }

  public async onInitializeContext(agentContext: AgentContext) {
    const storeManager = agentContext.dependencyManager.resolve(AskarStoreManager)
    await storeManager.getInitializedStoreWithProfile(agentContext)
  }

  public async onProvisionContext(agentContext: AgentContext) {
    // We don't have any side effects to run
    if (agentContext.isRootAgentContext) {
      return
    }

    // Ensure we have a profile for context
    if (this.config.multiWalletDatabaseScheme === AskarMultiWalletDatabaseScheme.ProfilePerWallet) {
      const storeManager = agentContext.dependencyManager.resolve(AskarStoreManager)
      const { store, profile } = await storeManager.getInitializedStoreWithProfile(agentContext)
      if (!profile) return

      const profiles = await store.listProfiles()
      if (profiles.includes(profile)) return

      // Create profile for this context
      await store.createProfile(profile)
      return
    }

    // For new stores (so not profiles) we need to generate a wallet key
    await storeAskarStoreConfigForContextCorrelationId(agentContext, {
      key: this.config.askar.storeGenerateRawKey({}),
    })
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
