import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { FeatureRegistry } from '../../FeatureRegistry'
import { Protocol } from '../../models'

import { MessageHandlerRegistry } from '../../MessageHandlerRegistry'
import { OutOfBandApi } from './OutOfBandApi'
import { OutOfBandService } from './OutOfBandService'
import { HandshakeReuseAcceptedHandler, HandshakeReuseHandler } from './handlers'
import { OutOfBandRepository } from './repository'

export class OutOfBandModule implements Module {
  public readonly api = OutOfBandApi

  /**
   * Registers the dependencies of the ot of band module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Services
    dependencyManager.registerSingleton(OutOfBandService)

    // Repositories
    dependencyManager.registerSingleton(OutOfBandRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.resolve(FeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(MessageHandlerRegistry)
    const outOfBandService = agentContext.resolve(OutOfBandService)

    messageHandlerRegistry.registerMessageHandler(new HandshakeReuseHandler(outOfBandService))
    messageHandlerRegistry.registerMessageHandler(new HandshakeReuseAcceptedHandler(outOfBandService))

    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/out-of-band/1.1',
        roles: ['sender', 'receiver'],
      })
    )
  }
}
