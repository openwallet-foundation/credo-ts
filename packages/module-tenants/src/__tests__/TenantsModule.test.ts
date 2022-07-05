import { InjectionSymbols } from '@aries-framework/core'

import { DependencyManager } from '../../../core/src/plugins/DependencyManager'
import { TenantsApi } from '../TenantsApi'
import { TenantsModule } from '../TenantsModule'
import { TenantAgentContextProvider } from '../context/TenantAgentContextProvider'
import { TenantSessionCoordinator } from '../context/TenantSessionCoordinator'
import { TenantRepository, TenantRoutingRepository } from '../repository'
import { TenantService } from '../services'

jest.mock('../../../core/src/plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('TenantsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    TenantsModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(TenantsApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TenantService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TenantRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TenantRoutingRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(
      InjectionSymbols.AgentContextProvider,
      TenantAgentContextProvider
    )
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TenantSessionCoordinator)
  })
})
