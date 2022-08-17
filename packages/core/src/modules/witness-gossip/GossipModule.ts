import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'

import { WitnessGossipHandler } from './handlers/WitnessGossipHandler'
import { GossipService } from './service'

@scoped(Lifecycle.ContainerScoped)
export class GossipModule {
  private gossipService: GossipService

  public constructor(dispatcher: Dispatcher, gossipService: GossipService) {
    this.gossipService = gossipService
    this.registerHandlers(dispatcher)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new WitnessGossipHandler(this.gossipService))
  }
}
