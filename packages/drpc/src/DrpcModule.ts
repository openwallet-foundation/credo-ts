import type { FeatureRegistry, DependencyManager, Module } from '@credo-ts/core'

import { Protocol, AgentConfig } from '@credo-ts/core'

import { DrpcApi } from './DrpcApi'
import { DrpcRole } from './models/DrpcRole'
import { DrpcRepository } from './repository'
import { DrpcService } from './services'

export class DrpcModule implements Module {
  public readonly api = DrpcApi

  /**
   * Registers the dependencies of the drpc message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
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

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/drpc/1.0',
        roles: [DrpcRole.Client, DrpcRole.Server],
      })
    )
  }
}
