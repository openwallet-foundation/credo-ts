import type {
  AgentContext,
  AgentModulesInput,
  Constructor,
  DependencyManager,
  EmptyModuleMap,
  Module,
  Update,
} from '@credo-ts/core'
import { CacheModuleConfig, CredoError, InjectionSymbols, SingleContextStorageLruCache } from '@credo-ts/core'
import { TenantAgentContextProvider } from './context/TenantAgentContextProvider'
import { TenantSessionCoordinator } from './context/TenantSessionCoordinator'
import { TenantRepository, TenantRoutingRepository } from './repository'
import { TenantRecordService } from './services'
import { TenantsApi } from './TenantsApi'
import type { TenantsModuleConfigOptions } from './TenantsModuleConfig'
import { TenantsModuleConfig } from './TenantsModuleConfig'
import { updateTenantsModuleV0_4ToV0_5 } from './updates/0.4-0.5'

export class TenantsModule<AgentModules extends AgentModulesInput = EmptyModuleMap> implements Module {
  public readonly config: TenantsModuleConfig

  public readonly api: Constructor<TenantsApi<AgentModules>> = TenantsApi

  public constructor(config?: TenantsModuleConfigOptions) {
    this.config = new TenantsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the tenants module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
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

  public async initialize(agentContext: AgentContext) {
    // This cache only supports one agent context, and throws once a tenant uses it
    if (agentContext.resolve(CacheModuleConfig).cache instanceof SingleContextStorageLruCache) {
      throw new CredoError(
        "The 'SingleContextStorageLruCache' (the default when no 'CacheModule' is registered) can't be used with the 'TenantsModule'. Register the 'CacheModule' with another cache, such as the 'InMemoryLruCache' or the 'RedisCache' from '@credo-ts/redis-cache'."
      )
    }
  }

  public updates = [
    {
      fromVersion: '0.4',
      toVersion: '0.5',
      doUpdate: updateTenantsModuleV0_4ToV0_5,
    },
  ] satisfies Update[]
}
