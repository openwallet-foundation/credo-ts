import type { DependencyManager, Module } from '@credo-ts/core'

import { WebVhApi } from './WebVhApi'
import { WebVhDidRegistrar, WebVhDidResolver } from './dids'

export class WebVhModule implements Module {
  public readonly api = WebVhApi

  /**
   * Registers the dependencies of the WebVH module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(WebVhDidResolver)
    dependencyManager.registerSingleton(WebVhDidRegistrar)
    dependencyManager.registerContextScoped(WebVhApi)
  }
}
