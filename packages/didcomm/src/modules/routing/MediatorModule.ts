import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { MediatorModuleConfigOptions } from './MediatorModuleConfig'

import { FeatureRegistry } from '../../FeatureRegistry'
import { Protocol } from '../../models'

import { MessageHandlerRegistry } from '../../MessageHandlerRegistry'
import { MediatorApi } from './MediatorApi'
import { MediatorModuleConfig } from './MediatorModuleConfig'
import { ForwardHandler, KeylistUpdateHandler, MediationRequestHandler } from './handlers'
import { MediationRole } from './models'
import { MediationRepository, MediatorRoutingRepository } from './repository'
import { MediatorService } from './services'

export class MediatorModule implements Module {
  public readonly config: MediatorModuleConfig
  public readonly api = MediatorApi

  public constructor(config?: MediatorModuleConfigOptions) {
    this.config = new MediatorModuleConfig(config)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(MediatorModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(MediatorService)

    // Repositories
    dependencyManager.registerSingleton(MediationRepository)
    dependencyManager.registerSingleton(MediatorRoutingRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.dependencyManager.resolve(FeatureRegistry)
    const messageHandlerRegistry = agentContext.dependencyManager.resolve(MessageHandlerRegistry)
    const mediatorService = agentContext.dependencyManager.resolve(MediatorService)

    // Should we use dependency injection for the message handlers as well?
    messageHandlerRegistry.registerMessageHandler(new KeylistUpdateHandler(mediatorService))
    messageHandlerRegistry.registerMessageHandler(new ForwardHandler(mediatorService))
    messageHandlerRegistry.registerMessageHandler(new MediationRequestHandler(mediatorService, this.config))

    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/coordinate-mediation/1.0',
        roles: [MediationRole.Mediator],
      })
    )
  }

  public async onInitializeContext(agentContext: AgentContext): Promise<void> {
    // Mediator initialization only supported for root agent
    if (!agentContext.isRootAgentContext) return

    const mediatorService = agentContext.dependencyManager.resolve(MediatorService)
    agentContext.config.logger.debug('Mediator routing record not loaded yet, retrieving from storage')
    const routingRecord = await mediatorService.findMediatorRoutingRecord(agentContext)

    // If we don't have a routing record yet for this tenant, create it
    if (!routingRecord) {
      agentContext.config.logger.debug('Mediator routing record does not exist yet, creating routing keys and record')
      await mediatorService.createMediatorRoutingRecord(agentContext)
    }
  }
}
