import type { DependencyManager } from '@aries-framework/core'

import { InjectionSymbols, module } from '@aries-framework/core'

import { TenantsApi } from './TenantsApi'
import { TenantAgentContextProvider } from './context/TenantAgentContextProvider'
import { TenantSessionCoordinator } from './context/TenantSessionCoordinator'
import { TenantRepository, TenantRoutingRepository } from './repository'
import { TenantService } from './services'

@module()
export class TenantsModule {
  /**
   * Registers the dependencies of the tenants module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    // NOTE: this is a singleton because tenants can't have their own tenants. This makes sure the tenants api is always used in the root agent context.
    dependencyManager.registerSingleton(TenantsApi)

    // Services
    dependencyManager.registerSingleton(TenantService)

    // Repositories
    dependencyManager.registerSingleton(TenantRepository)
    dependencyManager.registerSingleton(TenantRoutingRepository)

    dependencyManager.registerSingleton(InjectionSymbols.AgentContextProvider, TenantAgentContextProvider)
    dependencyManager.registerSingleton(TenantSessionCoordinator)
  }
}
