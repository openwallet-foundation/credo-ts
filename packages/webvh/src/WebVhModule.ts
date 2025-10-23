import type { DependencyManager, Module } from '@credo-ts/core'

import { WebVhDidResolver, WebVhDidRegistrar } from './dids'

export class WebVhModule implements Module {
  /**
   * Registers the dependencies of the WebVH module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(WebVhDidResolver)
    dependencyManager.registerSingleton(WebVhDidRegistrar)
  }
}
