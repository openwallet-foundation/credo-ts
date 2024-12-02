import type { MediatorModuleConfigOptions } from './MediatorModuleConfig'
import type { AgentContext } from '../../../agent'
import type { DependencyManager, Module } from '../../../plugins'

import { FeatureRegistry } from '../FeatureRegistry'
import { Protocol } from '../models'

import { MediatorApi } from './MediatorApi'
import { MediatorModuleConfig } from './MediatorModuleConfig'
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

    // Features
    const featureRegistry = dependencyManager.resolve(FeatureRegistry)

    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/coordinate-mediation/1.0',
        roles: [MediationRole.Mediator],
      })
    )
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
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
