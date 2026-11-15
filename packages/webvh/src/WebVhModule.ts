import { type DependencyManager, DidsModuleConfig, type Module } from '@credo-ts/core'
import { WebVhDidRegistrar, WebVhDidResolver } from './dids'
import { WebVhApi } from './WebVhApi'

export class WebVhModule implements Module {
  public readonly api = WebVhApi

  /**
   * Registers the dependencies of the WebVH module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // A WebVhDidResolver configured on the DidsModule is kept, so its options apply.
    const didsModuleConfig = dependencyManager.resolve(DidsModuleConfig)
    if (!didsModuleConfig.resolvers.some((resolver) => resolver instanceof WebVhDidResolver)) {
      didsModuleConfig.addResolver(new WebVhDidResolver())
    }

    dependencyManager.registerSingleton(WebVhDidRegistrar)
    dependencyManager.registerContextScoped(WebVhApi)
  }
}
