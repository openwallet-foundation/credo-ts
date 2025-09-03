import type { DocumentLoaderWithContext } from './data-integrity/libraries/documentLoader'

import { defaultDocumentLoader } from './data-integrity/libraries/documentLoader'

/**
 * W3cV2CredentialsModuleConfigOptions defines the interface for the options of the W3cV2CredentialsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface W3cV2CredentialsModuleConfigOptions {
  /**
   * Document loader to use for resolving JSON-LD objects. Takes a {@link AgentContext} as parameter,
   * and must return a {@link DocumentLoader} function.
   *
   * @example
   * ```
   * const myDocumentLoader = (agentContext: AgentContext) => {
   *   return async (url) => {
   *     if (url !== 'https://example.org') throw new Error("I don't know how to load this document")
   *
   *     return {
   *       contextUrl: null,
   *       documentUrl: url,
   *       document: null
   *     }
   *   }
   * }
   * ```
   *
   *
   * @default {@link defaultDocumentLoader}
   */
  documentLoader?: DocumentLoaderWithContext
}

export class W3cV2CredentialsModuleConfig {
  private options: W3cV2CredentialsModuleConfigOptions

  public constructor(options?: W3cV2CredentialsModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link W3cV2CredentialsModuleConfigOptions.documentLoader} */
  public get documentLoader() {
    return this.options.documentLoader ?? defaultDocumentLoader
  }
}
