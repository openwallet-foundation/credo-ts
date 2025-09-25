import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { AgentConfig } from '@credo-ts/core'
import { FeatureRegistry, MessageHandlerRegistry, Protocol } from '@credo-ts/didcomm'

import { DrpcApi } from './DrpcApi'
import { DrpcRequestHandler, DrpcResponseHandler } from './handlers'
import { DrpcRole } from './models/DrpcRole'
import { DrpcRepository } from './repository'
import { DrpcService } from './services'

export class DrpcModule implements Module {
  public readonly api = DrpcApi

  /**
   * Registers the dependencies of the drpc message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@credo-ts/drpc' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
      )

    // Services
    dependencyManager.registerSingleton(DrpcService)

    // Repositories
    dependencyManager.registerSingleton(DrpcRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.resolve(FeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(MessageHandlerRegistry)
    const drpcMessageService = agentContext.resolve(DrpcService)

    messageHandlerRegistry.registerMessageHandler(new DrpcRequestHandler(drpcMessageService))
    messageHandlerRegistry.registerMessageHandler(new DrpcResponseHandler(drpcMessageService))

    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/drpc/1.0',
        roles: [DrpcRole.Client, DrpcRole.Server],
      })
    )
  }
}
