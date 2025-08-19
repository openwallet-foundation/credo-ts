import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { DidCommDiscoverFeaturesModuleConfigOptions } from './DidCommDiscoverFeaturesModuleConfig'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommProtocol } from '../../models'

import { DidCommDiscoverFeaturesApi } from './DidCommDiscoverFeaturesApi'
import { DidCommDiscoverFeaturesModuleConfig } from './DidCommDiscoverFeaturesModuleConfig'
import { V1DidCommDiscoverFeaturesService } from './protocol/v1'
import { V2DidCommDiscoverFeaturesService } from './protocol/v2'

export class DidCommDiscoverFeaturesModule implements Module {
  public readonly api = DidCommDiscoverFeaturesApi
  public readonly config: DidCommDiscoverFeaturesModuleConfig

  public constructor(config?: DidCommDiscoverFeaturesModuleConfigOptions) {
    this.config = new DidCommDiscoverFeaturesModuleConfig(config)
  }

  /**
   * Registers the dependencies of the discover features module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommDiscoverFeaturesModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(V1DidCommDiscoverFeaturesService)
    dependencyManager.registerSingleton(V2DidCommDiscoverFeaturesService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // Features
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/discover-features/1.0',
        roles: ['requester', 'responder'],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/discover-features/2.0',
        roles: ['requester', 'responder'],
      })
    )
  }
}
