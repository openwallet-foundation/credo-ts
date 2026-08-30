import type { DocumentLoaderWithContext } from './documentLoader'
import { defaultDocumentLoader } from './documentLoader'

export interface JsonLdModuleConfigOptions {
  /**
   * Document loader to use for resolving JSON-LD objects.
   *
   * @default {@link defaultDocumentLoader}
   */
  documentLoader?: DocumentLoaderWithContext
}

export class JsonLdModuleConfig {
  private options: JsonLdModuleConfigOptions

  public constructor(options?: JsonLdModuleConfigOptions) {
    this.options = options ?? {}
  }

  public get documentLoader() {
    return this.options.documentLoader ?? defaultDocumentLoader
  }
}
