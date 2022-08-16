import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'

import { WitnessGossipHandler } from './handlers/WitnessGossipHandler'
import { WitnessTableHandler } from './handlers/WitnessTableHandler'
import { WitnessTableQueryHandler } from './handlers/WitnessTableQueryHandler'
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
    dispatcher.registerHandler(new WitnessTableQueryHandler(this.gossipService))
    dispatcher.registerHandler(new WitnessTableHandler(this.gossipService))
  }
}
