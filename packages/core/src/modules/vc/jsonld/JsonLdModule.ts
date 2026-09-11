import type { DependencyManager, Module } from '../../../plugins'
import { JsonLdModuleConfig, type JsonLdModuleConfigOptions } from './JsonLdModuleConfig'

/**
 * @public
 */
export class JsonLdModule implements Module {
  public readonly config: JsonLdModuleConfig

  public constructor(config?: JsonLdModuleConfigOptions) {
    this.config = new JsonLdModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(JsonLdModuleConfig, this.config)
  }
}
