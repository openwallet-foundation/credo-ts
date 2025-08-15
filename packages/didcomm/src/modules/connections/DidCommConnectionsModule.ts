import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { DidCommConnectionsModuleConfigOptions } from './DidCommConnectionsModuleConfig'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommProtocol } from '../../models'

import { DidCommConnectionsApi } from './DidCommConnectionsApi'
import { DidCommConnectionsModuleConfig } from './DidCommConnectionsModuleConfig'
import { DidExchangeProtocol } from './DidExchangeProtocol'
import { DidCommConnectionRole, DidCommDidExchangeRole, DidCommDidRotateRole } from './models'
import { DidCommConnectionRepository } from './repository'
import { DidCommConnectionService, DidCommDidRotateService, DidCommTrustPingService } from './services'

export class DidCommConnectionsModule implements Module {
  public readonly config: DidCommConnectionsModuleConfig
  public readonly api = DidCommConnectionsApi

  public constructor(config?: DidCommConnectionsModuleConfigOptions) {
    this.config = new DidCommConnectionsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the connections module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommConnectionsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(DidCommConnectionService)
    dependencyManager.registerSingleton(DidExchangeProtocol)
    dependencyManager.registerSingleton(DidCommDidRotateService)
    dependencyManager.registerSingleton(DidCommTrustPingService)

    // Repositories
    dependencyManager.registerSingleton(DidCommConnectionRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // Features
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/connections/1.0',
        roles: [DidCommConnectionRole.Invitee, DidCommConnectionRole.Inviter],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/didexchange/1.1',
        roles: [DidCommDidExchangeRole.Requester, DidCommDidExchangeRole.Responder],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/did-rotate/1.0',
        roles: [DidCommDidRotateRole.RotatingParty, DidCommDidRotateRole.ObservingParty],
      })
    )
  }
}
