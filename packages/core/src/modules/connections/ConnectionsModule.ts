import type { ConnectionsModuleConfigOptions } from './ConnectionsModuleConfig'
import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { DependencyManager, Module } from '../../plugins'

import { Protocol } from '../../agent/models'

import { ConnectionsApi } from './ConnectionsApi'
import { ConnectionsModuleConfig } from './ConnectionsModuleConfig'
import { DidExchangeProtocol } from './DidExchangeProtocol'
import { ConnectionRole, DidExchangeRole, DidRotateRole } from './models'
import { ConnectionRepository } from './repository'
import { ConnectionService, DidRotateService, TrustPingService } from './services'

export class ConnectionsModule implements Module {
  public readonly config: ConnectionsModuleConfig
  public readonly api = ConnectionsApi

  public constructor(config?: ConnectionsModuleConfigOptions) {
    this.config = new ConnectionsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the connections module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(ConnectionsApi)

    // Config
    dependencyManager.registerInstance(ConnectionsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(ConnectionService)
    dependencyManager.registerSingleton(DidExchangeProtocol)
    dependencyManager.registerSingleton(DidRotateService)
    dependencyManager.registerSingleton(TrustPingService)

    // Repositories
    dependencyManager.registerSingleton(ConnectionRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/connections/1.0',
        roles: [ConnectionRole.Invitee, ConnectionRole.Inviter],
      }),
      new Protocol({
        id: 'https://didcomm.org/didexchange/1.1',
        roles: [DidExchangeRole.Requester, DidExchangeRole.Responder],
      }),
      new Protocol({
        id: 'https://didcomm.org/did-rotate/1.0',
        roles: [DidRotateRole.RotatingParty, DidRotateRole.ObservingParty],
      })
    )
  }
}
