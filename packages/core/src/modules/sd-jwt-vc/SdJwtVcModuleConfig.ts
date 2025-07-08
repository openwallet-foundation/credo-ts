import { TokenStatusListRegistry } from './credential-status'
import { HttpTokenStatusListRegistry } from './credential-status/token-status-list/http/HttpTokenStatusListRegistry'

/**
 * SdJwtVcModuleConfigOptions defines the interface for the options of the SdJwtVcModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface SdJwtVcModuleConfigOptions {
  /**
   * List of token status list registries that should be used by the dids module. The registrar must
   * be an instance of the {@link TokenStatusListRegistry} interface.
   *
   * If no registries are provided, the default registries will be used. `PeerTokenStatusListRegistry` and `KeyTokenStatusListRegistry`
   * will ALWAYS be registered, as they are needed for connections, mediation and out of band modules to function.
   * Other did methods can be disabled.
   *
   */
  registries?: TokenStatusListRegistry[]
}

export class SdJwtVcModuleConfig {
  private options: SdJwtVcModuleConfigOptions
  private _registries: TokenStatusListRegistry[] | undefined

  public constructor(options?: SdJwtVcModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link SdJwtVcModuleConfigOptions.registries} */
  public get registries(): TokenStatusListRegistry[] {
    // This prevents creating new instances every time this property is accessed
    if (this._registries) return this._registries

    this._registries = [...(this.options.registries || []), new HttpTokenStatusListRegistry()]

    return this._registries
  }

  public addRegistry(registry: TokenStatusListRegistry) {
    this.registries.push(registry)
  }
}
