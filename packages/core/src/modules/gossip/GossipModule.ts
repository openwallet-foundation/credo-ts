import type { DependencyManager } from '../../plugins'

import { Dispatcher } from '../../agent/Dispatcher'
import { module, injectable } from '../../plugins'

import { WitnessTableHandler, WitnessTableQueryHandler } from './handlers'
import { WitnessGossipHandler } from './handlers/WitnessGossipHandler'
import { WitnessStateRepository } from './repository'
import { GossipService } from './service'

@module()
@injectable()
export class GossipModule {
  private gossipService: GossipService

  public constructor(dispatcher: Dispatcher, gossipService: GossipService) {
    this.gossipService = gossipService
    this.registerHandlers(dispatcher)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new WitnessGossipHandler(this.gossipService))
    dispatcher.registerHandler(new WitnessTableQueryHandler(this.gossipService))
    dispatcher.registerHandler(new WitnessTableHandler(this.gossipService))
  }

  /**
   * Registers the dependencies of the gossip module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(GossipModule)

    // Services
    dependencyManager.registerSingleton(GossipService)

    // Repositories
    dependencyManager.registerSingleton(WitnessStateRepository)
  }
}
