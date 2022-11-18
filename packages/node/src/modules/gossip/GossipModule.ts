import type { DependencyManager } from '@aries-framework/core'

import { Dispatcher, module, injectable, InjectionSymbols, inject } from '@aries-framework/core'

import { WitnessGossipMessageHandler } from './handlers'
import { GossipService } from './services'

@module()
@injectable()
export class GossipModule {
  private readonly gossipService: GossipService

  public constructor(dispatcher: Dispatcher, @inject(InjectionSymbols.GossipService) gossipService: GossipService) {
    this.gossipService = gossipService
    this.registerHandlers(dispatcher)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new WitnessGossipMessageHandler(this.gossipService))
  }

  /**
   * Registers the dependencies of the gossip module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerSingleton(GossipModule)

    // Services
    dependencyManager.registerSingleton(InjectionSymbols.GossipService, GossipService)

    // Resolve to create module instance
    dependencyManager.resolve(GossipModule)
  }
}
