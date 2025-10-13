import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommProtocol } from '../../models'
import { DidCommMediatorApi } from './DidCommMediatorApi'
import type { DidCommMediatorModuleConfigOptions } from './DidCommMediatorModuleConfig'
import { DidCommMediatorModuleConfig } from './DidCommMediatorModuleConfig'
import { DidCommForwardHandler } from './handlers/DidCommForwardHandler'
import { DidCommKeylistUpdateHandler } from './handlers/DidCommKeylistUpdateHandler'
import { DidCommMediationRequestHandler } from './handlers/DidCommMediationRequestHandler'
import { DidCommMediationRole } from './models'
import { DidCommMediationRepository, DidCommMediatorRoutingRepository } from './repository'
import { DidCommMediatorService } from './services'

export class DidCommMediatorModule implements Module {
  public readonly config: DidCommMediatorModuleConfig
  public readonly api = DidCommMediatorApi

  public constructor(config?: DidCommMediatorModuleConfigOptions) {
    this.config = new DidCommMediatorModuleConfig(config)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommMediatorModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(DidCommMediatorService)

    // Repositories
    dependencyManager.registerSingleton(DidCommMediationRepository)
    dependencyManager.registerSingleton(DidCommMediatorRoutingRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(DidCommMessageHandlerRegistry)
    const mediatorService = agentContext.resolve(DidCommMediatorService)

    messageHandlerRegistry.registerMessageHandler(new DidCommKeylistUpdateHandler(mediatorService))
    messageHandlerRegistry.registerMessageHandler(new DidCommForwardHandler(mediatorService))
    messageHandlerRegistry.registerMessageHandler(new DidCommMediationRequestHandler(mediatorService, this.config))

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/coordinate-mediation/1.0',
        roles: [DidCommMediationRole.Mediator],
      })
    )
  }

  public async onInitializeContext(agentContext: AgentContext): Promise<void> {
    // Mediator initialization only supported for root agent
    if (!agentContext.isRootAgentContext) return

    const mediatorService = agentContext.dependencyManager.resolve(DidCommMediatorService)
    agentContext.config.logger.debug('Mediator routing record not loaded yet, retrieving from storage')
    const routingRecord = await mediatorService.findMediatorRoutingRecord(agentContext)

    // If we don't have a routing record yet for this tenant, create it
    if (!routingRecord) {
      agentContext.config.logger.debug('Mediator routing record does not exist yet, creating routing keys and record')
      await mediatorService.createMediatorRoutingRecord(agentContext)
    }
  }
}
