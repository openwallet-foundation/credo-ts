import type { DependencyManager, Module } from '../../../plugins'
import type { Optional } from '../../../types'
import { defaultDocumentLoader } from './documentLoader'
import { JsonLdModuleConfig, type JsonLdModuleConfigOptions } from './JsonLdModuleConfig'

export type JsonLdModuleOptions = Optional<JsonLdModuleConfigOptions, 'documentLoader'>

/**
 * @public
 */
export class JsonLdModule implements Module {
  public readonly config: JsonLdModuleConfig

  public constructor(config?: JsonLdModuleOptions) {
    this.config = new JsonLdModuleConfig({
      ...config,
      // NOTE: the default is set here rather than in the JsonLdModuleConfig to avoid a dependency cycle.
      documentLoader: config?.documentLoader ?? defaultDocumentLoader,
    })
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(JsonLdModuleConfig, this.config)
  }
}
