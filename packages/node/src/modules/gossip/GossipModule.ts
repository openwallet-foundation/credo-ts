import type { DependencyManager } from '@aries-framework/core'

import { Dispatcher, module, injectable, InjectionSymbols } from '@aries-framework/core'

import { WitnessGossipMessageHandler } from './handlers'
import { GossipService } from './service'

@module()
@injectable()
export class GossipModule {
  private readonly gossipService: GossipService

  public constructor(dispatcher: Dispatcher, gossipService: GossipService) {
    this.gossipService = gossipService
    this.registerHandlers(dispatcher)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    dispatcher.registerHandler(new WitnessGossipMessageHandler(this.gossipService))
  }

  /**
   * Registers the dependencies of the gossip module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(GossipModule)

    // Services
    dependencyManager.registerSingleton(InjectionSymbols.GossipService, GossipService)
  }
}
