import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommProtocol } from '../../models'

import { DidCommOutOfBandApi } from './DidCommOutOfBandApi'
import { DidCommOutOfBandService } from './DidCommOutOfBandService'
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
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/out-of-band/1.1',
        roles: ['sender', 'receiver'],
      })
    )
  }
}
