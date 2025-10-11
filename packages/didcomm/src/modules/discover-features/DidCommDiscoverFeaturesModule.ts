import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { DidCommDiscoverFeaturesModuleConfigOptions } from './DidCommDiscoverFeaturesModuleConfig'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommProtocol } from '../../models'

import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommDiscoverFeaturesApi } from './DidCommDiscoverFeaturesApi'
import { DidCommDiscoverFeaturesModuleConfig } from './DidCommDiscoverFeaturesModuleConfig'
import { DidCommDiscoverFeaturesV1Service } from './protocol/v1'
import { DidCommDiscoverFeaturesV2Service } from './protocol/v2'

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
    dependencyManager.registerSingleton(DidCommDiscoverFeaturesV1Service)
    dependencyManager.registerSingleton(DidCommDiscoverFeaturesV2Service)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.resolve(DidCommFeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(DidCommMessageHandlerRegistry)

    const v1DiscoverFeatureService = agentContext.resolve(DidCommDiscoverFeaturesV1Service)
    const v2DiscoverFeatureService = agentContext.resolve(DidCommDiscoverFeaturesV2Service)

    v1DiscoverFeatureService.register(messageHandlerRegistry)
    v2DiscoverFeatureService.register(messageHandlerRegistry)

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
