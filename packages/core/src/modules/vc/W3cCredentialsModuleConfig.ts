import type { JsonLdModuleConfigOptions } from './jsonld/JsonLdModuleConfig'
import { JsonLdModuleConfig } from './jsonld/JsonLdModuleConfig'
import type { SuiteInfo } from './linked-data-proofs/SignatureSuiteRegistry'

/**
 * W3cCredentialsModuleConfigOptions defines the interface for the options of the W3cCredentialsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface W3cCredentialsModuleConfigOptions extends JsonLdModuleConfigOptions {
  /**
   * Linked-data proof signature suites to register in addition to the built-in suites.
   * Suites with the same proof type replace the built-in suite.
   */
  signatureSuites?: SuiteInfo[]
}

/**
 * @deprecated Use {@link JsonLdModuleConfig} for shared JSON-LD configuration.
 * This compatibility class preserves the existing VC module API.
 */
export class W3cCredentialsModuleConfig extends JsonLdModuleConfig {
  public readonly signatureSuites: SuiteInfo[]

  public constructor(options?: W3cCredentialsModuleConfigOptions) {
    super(options)
    this.signatureSuites = options?.signatureSuites ?? []
  }
}
