import type { DependencyManager, Module } from '@credo-ts/core'

import { WebvhModuleConfig } from './WebvhModuleConfig'
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
    dependencyManager.registerInstance(WebvhModuleConfig, this.config)
    dependencyManager.registerSingleton(WebvhDidResolver)
  }
}
