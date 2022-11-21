import type { GossipService } from './services'
import type { Agent } from '@aries-framework/core'

import { AriesFrameworkError, InjectionSymbols } from '@aries-framework/core'

import { GossipModule } from './GossipModule'

export async function initWitnessGossip(agent: Agent) {
  if (!agent.config.valueTransferConfig?.witness) {
    throw new AriesFrameworkError('Cannot init Witness Gossip - provided agent is not configured as a Witness')
  }

  agent.dependencyManager.registerModules(GossipModule)

  const gossipService = agent.dependencyManager.resolve<GossipService>(InjectionSymbols.GossipService)
  await gossipService.initState()
  await gossipService.start()
}
