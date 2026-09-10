import type { JsonLdModuleConfigOptions } from './jsonld/JsonLdModuleConfig'
import { JsonLdModuleConfig } from './jsonld/JsonLdModuleConfig'

/**
 * W3cCredentialsModuleConfigOptions defines the interface for the options of the W3cCredentialsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export type W3cCredentialsModuleConfigOptions = JsonLdModuleConfigOptions

/**
 * @deprecated Use {@link JsonLdModuleConfig} for shared JSON-LD configuration.
 * This compatibility class preserves the existing VC module API.
 */
export class W3cCredentialsModuleConfig extends JsonLdModuleConfig {}
