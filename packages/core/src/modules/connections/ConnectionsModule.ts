import type { DependencyManager, Module } from '../../plugins'
import type { ConnectionsModuleConfigOptions } from './ConnectionsModuleConfig'

import { ConnectionsApi } from './ConnectionsApi'
import { ConnectionsModuleConfig } from './ConnectionsModuleConfig'
import { DidExchangeProtocol } from './DidExchangeProtocol'
import { ConnectionRepository } from './repository'
import { ConnectionService, TrustPingService } from './services'

export class ConnectionsModule implements Module {
  public readonly config: ConnectionsModuleConfig

  public constructor(config?: ConnectionsModuleConfigOptions) {
    this.config = new ConnectionsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the connections module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(ConnectionsApi)

    // Config
    dependencyManager.registerInstance(ConnectionsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(ConnectionService)
    dependencyManager.registerSingleton(DidExchangeProtocol)
    dependencyManager.registerSingleton(TrustPingService)

    // Repositories
    dependencyManager.registerSingleton(ConnectionRepository)
  }
}
