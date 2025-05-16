import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { DrizzleStorageModuleConfigOptions } from './DrizzleStorageModuleConfig'

import { CredoError, InjectionSymbols, StorageUpdateService } from '@credo-ts/core'

import { DrizzleStorageModuleConfig } from './DrizzleStorageModuleConfig'
import { DrizzleStorageService } from './storage'

export class DrizzleStorageModule implements Module {
  public readonly config: DrizzleStorageModuleConfig

  public constructor(config: DrizzleStorageModuleConfigOptions) {
    this.config = new DrizzleStorageModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(DrizzleStorageModuleConfig, this.config)

    if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new CredoError(
        'Unable to register DrizzleStorageService. There is an instance of StorageService already registered'
      )
    }
    dependencyManager.registerSingleton(InjectionSymbols.StorageService, DrizzleStorageService)
  }

  public async onInitializeContext(agentContext: AgentContext): Promise<void> {
    // For the root agent context we don't call provision, we should probably change that
    // but this is because agent.initialize doesn't differantiate between create and open
    // So we need to check basically when we start the agent if this is a new agent
    // and if so, set the framework storage version. This is a bit inefficient, as we will
    // again fetch the record after the module has been initialized, but probably something
    // we can improve with caching.
    if (agentContext.isRootAgentContext) {
      const storageUpdateService = agentContext.resolve(StorageUpdateService)

      // Previously if we didn't have a storage version record yet it meant we assumed you
      // were on 0.1 before the record was added, but since this module is introduced in 0.6
      // we can be sure that's not the case.
      if (!(await storageUpdateService.hasStorageVersionRecord(agentContext))) {
        await storageUpdateService.setCurrentStorageVersion(agentContext, StorageUpdateService.frameworkStorageVersion)
      }
    }
  }

  public async onProvisionContext(agentContext: AgentContext): Promise<void> {
    // This method is never called for root agent context
    // but to be sure if that changesin the future
    if (agentContext.isRootAgentContext) return

    // For new contexts, we need to set the storage version
    const storageUpdateService = agentContext.resolve(StorageUpdateService)
    await storageUpdateService.setCurrentStorageVersion(agentContext, StorageUpdateService.frameworkStorageVersion)
  }

  public async onDeleteContext(_agentContext: AgentContext): Promise<void> {
    // TODO: delete all tables where the contextCorrelationId is this context correlation id
    // TODO: we need to add a deleteAllByContextCorrelationId to the adapter
    // const tables = this.config.adapters.forEach(a => a.delete())
  }
}
