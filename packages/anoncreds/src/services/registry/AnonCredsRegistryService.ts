import type { AnonCredsRegistry } from '.'
import type { AgentContext } from '@aries-framework/core'

import { injectable } from '@aries-framework/core'

import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import { AnonCredsError } from '../../error'

/**
 * @internal
 * The AnonCreds registry service manages multiple {@link AnonCredsRegistry} instances
 * and returns the correct registry based on a given identifier
 */
@injectable()
export class AnonCredsRegistryService {
  public getRegistryForIdentifier(agentContext: AgentContext, identifier: string): AnonCredsRegistry {
    const registries = agentContext.dependencyManager.resolve(AnonCredsModuleConfig).registries

    // TODO: should we check if multiple are registered?
    const registry = registries.find((registry) => registry.supportedIdentifier.test(identifier))

    if (!registry) {
      throw new AnonCredsError(`No AnonCredsRegistry registered for identifier '${identifier}'`)
    }

    return registry
  }
}
