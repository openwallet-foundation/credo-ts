import type { DependencyManager, Module } from '@credo-ts/core'

import { WebVhDidRegistrar, WebVhDidResolver } from './dids'

export class WebVhModule implements Module {
  /**
   * Registers the dependencies of the WebVH module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(WebVhDidResolver)
    dependencyManager.registerSingleton(WebVhDidRegistrar)
  }
}
