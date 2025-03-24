import type { DependencyManager, Module } from '@credo-ts/core'

import { WebvhModuleConfig } from './WebvhModuleConfig'
import { WebvhDidRegistrar } from './dids/WebvhDidRegistrar'
import { WebvhDidResolver } from './dids/WebvhDidResolver'

export class WebvhModule implements Module {
  public readonly config: WebvhModuleConfig

  public constructor(config?: WebvhModuleConfig) {
    this.config = config ?? new WebvhModuleConfig()
  }

  /**
   * Registers the dependencies of the WebVH module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Register config
    dependencyManager.registerInstance(WebvhModuleConfig, this.config)

    // Register did registrar and resolver
    dependencyManager.registerSingleton(WebvhDidRegistrar)
    dependencyManager.registerSingleton(WebvhDidResolver)
  }
}
