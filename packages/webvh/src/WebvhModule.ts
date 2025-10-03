import type { DependencyManager, Module } from '@credo-ts/core'

import { WebVhDidRegistrar, WebvhDidResolver } from './dids'

export class WebvhModule implements Module {
  /**
   * Registers the dependencies of the WebVH module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(WebvhDidResolver)
    dependencyManager.registerSingleton(WebVhDidRegistrar)
  }
}
