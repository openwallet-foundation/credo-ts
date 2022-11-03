import type { Constructor } from '../../utils/mixins'
import type { DidRegistrar, DidResolver } from './domain'

import {
  KeyDidRegistrar,
  SovDidRegistrar,
  PeerDidRegistrar,
  KeyDidResolver,
  PeerDidResolver,
  SovDidResolver,
  WebDidResolver,
} from './methods'

/**
 * DidsModuleConfigOptions defines the interface for the options of the DidsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface DidsModuleConfigOptions {
  /**
   * List of did registrars that should be registered on the dids module. The registrar must
   * follow the {@link DidRegistrar} interface, and must be constructable. The registrar will be injected
   * into the `DidRegistrarService` and should be decorated with the `@injectable` decorator.
   *
   * If no registrars are provided, the default registrars will be used. The `PeerDidRegistrar` will ALWAYS be
   * registered, as it is needed for the connections and out of band module to function. Other did methods can be
   * disabled.
   *
   * @default [KeyDidRegistrar, SovDidRegistrar, PeerDidRegistrar]
   */
  registrars?: Constructor<DidRegistrar>[]

  /**
   * List of did resolvers that should be registered on the dids module. The resolver must
   * follow the {@link DidResolver} interface, and must be constructable. The resolver will be injected
   * into the `DidResolverService` and should be decorated with the `@injectable` decorator.
   *
   * If no resolvers are provided, the default resolvers will be used. The `PeerDidResolver` will ALWAYS be
   * registered, as it is needed for the connections and out of band module to function. Other did methods can be
   * disabled.
   *
   * @default [SovDidResolver, WebDidResolver, KeyDidResolver, PeerDidResolver]
   */
  resolvers?: Constructor<DidResolver>[]
}

export class DidsModuleConfig {
  private options: DidsModuleConfigOptions

  public constructor(options?: DidsModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link DidsModuleConfigOptions.registrars} */
  public get registrars() {
    const registrars = this.options.registrars ?? [KeyDidRegistrar, SovDidRegistrar, PeerDidRegistrar]

    // If the peer did registrar is not included yet, add it
    return registrars.includes(PeerDidRegistrar) ? registrars : [...registrars, PeerDidRegistrar]
  }

  /** See {@link DidsModuleConfigOptions.resolvers} */
  public get resolvers() {
    const resolvers = this.options.resolvers ?? [SovDidResolver, WebDidResolver, KeyDidResolver, PeerDidResolver]

    // If the peer did resolver is not included yet, add it
    return resolvers.includes(PeerDidResolver) ? resolvers : [...resolvers, PeerDidResolver]
  }
}
