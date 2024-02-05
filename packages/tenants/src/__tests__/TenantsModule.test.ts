import { InjectionSymbols } from '@credo-ts/core'

import { DependencyManager } from '../../../core/src/plugins/DependencyManager'
import { mockFunction } from '../../../core/tests'
import { TenantsApi } from '../TenantsApi'
import { TenantsModule } from '../TenantsModule'
import { TenantsModuleConfig } from '../TenantsModuleConfig'
import { TenantAgentContextProvider } from '../context/TenantAgentContextProvider'
import { TenantSessionCoordinator } from '../context/TenantSessionCoordinator'
import { TenantRepository, TenantRoutingRepository } from '../repository'
import { TenantRecordService } from '../services'

jest.mock('../../../core/src/plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

mockFunction(dependencyManager.resolve).mockReturnValue({ logger: { warn: jest.fn() } })

describe('TenantsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const tenantsModule = new TenantsModule()
    tenantsModule.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(6)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TenantsApi)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TenantRecordService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TenantRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TenantRoutingRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(
      InjectionSymbols.AgentContextProvider,
      TenantAgentContextProvider
    )
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TenantSessionCoordinator)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(TenantsModuleConfig, tenantsModule.config)
  })

  test('TenantsApi should be registered as singleton rather than default context scoped', () => {
    const dependencyManager = new DependencyManager()
    const tenantsModule = new TenantsModule()
    tenantsModule.register(dependencyManager)

    const childDependencyManager = dependencyManager.createChild()

    expect(dependencyManager.resolve(TenantsApi)).toBe(childDependencyManager.resolve(TenantsApi))
  })
})
