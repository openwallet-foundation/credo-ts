import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { InMemoryStorageService } from './InMemoryStorageService'

import { CredoError, InjectionSymbols, Kms } from '@credo-ts/core'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../packages/node/src'

export class InMemoryWalletModule implements Module {
  private inMemoryStorageService = new InMemoryStorageService()
  private enableKms: boolean

  public constructor(config: { enableKms?: boolean } = {}) {
    this.enableKms = config.enableKms ?? true
  }

  public register(dependencyManager: DependencyManager) {
    if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new CredoError('There is an instance of StorageService already registered')
    }

    dependencyManager.registerInstance(InjectionSymbols.StorageService, this.inMemoryStorageService)

    if (this.enableKms) {
      const kmsConfig = dependencyManager.resolve(Kms.KeyManagementModuleConfig)

      // TODO: prevent double registration
      kmsConfig.registerBackend(new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()))
    }
  }

  public async onProvisionContext(agentContext: AgentContext): Promise<void> {
    this.inMemoryStorageService.createRecordsForContext(agentContext)
  }

  public async onDeleteContext(agentContext: AgentContext): Promise<void> {
    this.inMemoryStorageService.deleteRecordsForContext(agentContext)
  }
}
