import type { DocumentLoaderWithContext } from './documentLoader'
import { defaultDocumentLoader } from './documentLoader'

export interface JsonLdModuleConfigOptions {
  /**
   * Document loader to use for resolving JSON-LD objects.
   *
   * @default {@link defaultDocumentLoader}
   */
  documentLoader?: DocumentLoaderWithContext

  /**
   * Maximum size in bytes of a JSON-LD document fetched by the default document loader.
   *
   * @default the `maxResponseBytes` of the agent's `fetchLimits`
   */
  maxDocumentBytes?: number
}

export class JsonLdModuleConfig {
  private options: JsonLdModuleConfigOptions

  public constructor(options?: JsonLdModuleConfigOptions) {
    this.options = options ?? {}
  }

  public get documentLoader() {
    return this.options.documentLoader ?? defaultDocumentLoader
  }

  public get maxDocumentBytes() {
    return this.options.maxDocumentBytes
  }
}
