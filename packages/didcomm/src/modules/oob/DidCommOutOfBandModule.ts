import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommProtocol } from '../../models'
import { DidCommOutOfBandApi } from './DidCommOutOfBandApi'
import { DidCommOutOfBandService } from './DidCommOutOfBandService'
import { DidCommHandshakeReuseHandler } from './handlers'
import { DidCommHandshakeReuseAcceptedHandler } from './handlers/DidCommHandshakeReuseAcceptedHandler'
import { DidCommOutOfBandRepository } from './repository'

export class DidCommOutOfBandModule implements Module {
  public readonly api = DidCommOutOfBandApi

  /**
   * Registers the dependencies of the ot of band module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Services
    dependencyManager.registerSingleton(DidCommOutOfBandService)

    // Repositories
    dependencyManager.registerSingleton(DidCommOutOfBandRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // Features
    const featureRegistry = agentContext.resolve(DidCommFeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(DidCommMessageHandlerRegistry)
    const outOfBandService = agentContext.resolve(DidCommOutOfBandService)

    messageHandlerRegistry.registerMessageHandler(new DidCommHandshakeReuseHandler(outOfBandService))
    messageHandlerRegistry.registerMessageHandler(new DidCommHandshakeReuseAcceptedHandler(outOfBandService))

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/out-of-band/1.1',
        roles: ['sender', 'receiver'],
      })
    )
  }
}
