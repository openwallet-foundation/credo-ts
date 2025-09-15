import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { DiscoverFeaturesModuleConfigOptions } from './DiscoverFeaturesModuleConfig'

import { FeatureRegistry } from '../../FeatureRegistry'
import { Protocol } from '../../models'

import { MessageHandlerRegistry } from '../../MessageHandlerRegistry'
import { DiscoverFeaturesApi } from './DiscoverFeaturesApi'
import { DiscoverFeaturesModuleConfig } from './DiscoverFeaturesModuleConfig'
import { V1DiscoverFeaturesService } from './protocol/v1'
import { V2DiscoverFeaturesService } from './protocol/v2'

export class DiscoverFeaturesModule implements Module {
  public readonly api = DiscoverFeaturesApi
  public readonly config: DiscoverFeaturesModuleConfig

  public constructor(config?: DiscoverFeaturesModuleConfigOptions) {
    this.config = new DiscoverFeaturesModuleConfig(config)
  }

  /**
   * Registers the dependencies of the discover features module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DiscoverFeaturesModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(V1DiscoverFeaturesService)
    dependencyManager.registerSingleton(V2DiscoverFeaturesService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.resolve(FeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(MessageHandlerRegistry)

    const v1DiscoverFeatureService = agentContext.resolve(V1DiscoverFeaturesService)
    const v2DiscoverFeatureService = agentContext.resolve(V2DiscoverFeaturesService)

    v1DiscoverFeatureService.register(messageHandlerRegistry)
    v2DiscoverFeatureService.register(messageHandlerRegistry)

    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/discover-features/1.0',
        roles: ['requester', 'responder'],
      }),
      new Protocol({
        id: 'https://didcomm.org/discover-features/2.0',
        roles: ['requester', 'responder'],
      })
    )
  }
}
