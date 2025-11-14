import type { AgentContext } from '@credo-ts/core'
import { injectable } from '@credo-ts/core'
import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import { AnonCredsError } from '../../error'
import type { AnonCredsRegistry } from '.'

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
