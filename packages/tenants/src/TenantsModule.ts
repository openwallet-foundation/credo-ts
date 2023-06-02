import type { TenantsModuleConfigOptions } from './TenantsModuleConfig'
import type { Constructor, ModulesMap, DependencyManager, Module, EmptyModuleMap } from '@aries-framework/core'

import { AgentConfig, InjectionSymbols } from '@aries-framework/core'

import { TenantsApi } from './TenantsApi'
import { TenantsModuleConfig } from './TenantsModuleConfig'
import { TenantAgentContextProvider } from './context/TenantAgentContextProvider'
import { TenantSessionCoordinator } from './context/TenantSessionCoordinator'
import { TenantRepository, TenantRoutingRepository } from './repository'
import { TenantRecordService } from './services'

export class TenantsModule<AgentModules extends ModulesMap = EmptyModuleMap> implements Module {
  public readonly config: TenantsModuleConfig

  public readonly api: Constructor<TenantsApi<AgentModules>> = TenantsApi

  public constructor(config?: TenantsModuleConfigOptions) {
    this.config = new TenantsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the tenants module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/tenants' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Api
    // NOTE: this is a singleton because tenants can't have their own tenants. This makes sure the tenants api is always used in the root agent context.
    dependencyManager.registerSingleton(TenantsApi)

    // Config
    dependencyManager.registerInstance(TenantsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(TenantRecordService)

    // Repositories
    dependencyManager.registerSingleton(TenantRepository)
    dependencyManager.registerSingleton(TenantRoutingRepository)

    dependencyManager.registerSingleton(InjectionSymbols.AgentContextProvider, TenantAgentContextProvider)
    dependencyManager.registerSingleton(TenantSessionCoordinator)
  }
}
