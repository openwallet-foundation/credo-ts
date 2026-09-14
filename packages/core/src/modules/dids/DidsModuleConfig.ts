import type { DidRegistrar, DidResolver } from './domain'

import {
  JwkDidRegistrar,
  JwkDidResolver,
  KeyDidRegistrar,
  KeyDidResolver,
  PeerDidRegistrar,
  PeerDidResolver,
  WebDidResolver,
} from './methods'

const DEFAULT_PUBLIC_DID_METHODS = ['web', 'indy', 'sov', 'cheqd', 'hedera', 'webvh']

/**
 * DidsModuleConfigOptions defines the interface for the options of the DidsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface DidsModuleConfigOptions {
  /**
   * List of did registrars that should be used by the dids module. The registrar must
   * be an instance of the {@link DidRegistrar} interface.
   *
   * If no registrars are provided, the default registrars will be used. `PeerDidRegistrar` and `KeyDidRegistrar`
   * will ALWAYS be registered, as they are needed for connections, mediation and out of band modules to function.
   * Other did methods can be disabled.
   *
   * @default [KeyDidRegistrar, PeerDidRegistrar, JwkDidRegistrar]
   */
  registrars?: DidRegistrar[]

  /**
   * List of did resolvers that should be used by the dids module. The resolver must
   * be an instance of the {@link DidResolver} interface.
   *
   * If no resolvers are provided, the default resolvers will be used. `PeerDidResolver` and `KeyDidResolver`
   * will ALWAYS be registered, as they are needed for connections, mediation and out of band modules to function.
   * Other did methods can be disabled.
   *
   * @default [WebDidResolver, KeyDidResolver, PeerDidResolver, JwkDidResolver]
   */
  resolvers?: DidResolver[]

  /**
   * Did methods whose documents live in public, context-independent sources: resolving them
   * yields the same result in any agent context, so their documents can be cached in the global
   * scope shared across all agent contexts (when the resolver allows caching). Documents of
   * other did methods are cached per agent context.
   *
   * @default ['web', 'indy', 'sov', 'cheqd', 'hedera', 'webvh']
   */
  publicDidMethods?: string[]
}

export class DidsModuleConfig {
  private options: DidsModuleConfigOptions
  private _registrars: DidRegistrar[] | undefined
  private _resolvers: DidResolver[] | undefined

  public constructor(options?: DidsModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link DidsModuleConfigOptions.registrars} */
  public get registrars(): DidRegistrar[] {
    // This prevents creating new instances every time this property is accessed
    if (this._registrars) return this._registrars

    let registrars = this.options.registrars ?? [new KeyDidRegistrar(), new PeerDidRegistrar(), new JwkDidRegistrar()]

    // Add peer did registrar if it is not included yet
    if (!registrars.find((registrar) => registrar instanceof PeerDidRegistrar)) {
      // Do not modify original options array
      registrars = [...registrars, new PeerDidRegistrar()]
    }

    // Add key did registrar if it is not included yet
    if (!registrars.find((registrar) => registrar instanceof KeyDidRegistrar)) {
      // Do not modify original options array
      registrars = [...registrars, new KeyDidRegistrar()]
    }

    this._registrars = registrars
    return registrars
  }

  public addRegistrar(registrar: DidRegistrar) {
    this.registrars.push(registrar)
  }

  /** See {@link DidsModuleConfigOptions.resolvers} */
  public get resolvers(): DidResolver[] {
    // This prevents creating new instances every time this property is accessed
    if (this._resolvers) return this._resolvers

    let resolvers = this.options.resolvers ?? [
      new WebDidResolver(),
      new KeyDidResolver(),
      new PeerDidResolver(),
      new JwkDidResolver(),
    ]

    // Add peer did resolver if it is not included yet
    if (!resolvers.find((resolver) => resolver instanceof PeerDidResolver)) {
      // Do not modify original options array
      resolvers = [...resolvers, new PeerDidResolver()]
    }

    // Add key did resolver if it is not included yet
    if (!resolvers.find((resolver) => resolver instanceof KeyDidResolver)) {
      // Do not modify original options array
      resolvers = [...resolvers, new KeyDidResolver()]
    }

    this._resolvers = resolvers
    return resolvers
  }

  public addResolver(resolver: DidResolver) {
    this.resolvers.push(resolver)
  }

  /** See {@link DidsModuleConfigOptions.publicDidMethods} */
  public get publicDidMethods(): string[] {
    return this.options.publicDidMethods ?? DEFAULT_PUBLIC_DID_METHODS
  }
}
