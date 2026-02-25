import { InjectionSymbols } from '@credo-ts/core'

import type { MockedClassConstructor } from '../../../../tests/types'
import { DependencyManager } from '../../../core/src/plugins/DependencyManager'
import { mockFunction } from '../../../core/tests'
import { TenantAgentContextProvider } from '../context/TenantAgentContextProvider'
import { TenantSessionCoordinator } from '../context/TenantSessionCoordinator'
import { TenantRepository, TenantRoutingRepository } from '../repository'
import { TenantRecordService } from '../services'
import { TenantsApi } from '../TenantsApi'
import { TenantsModule } from '../TenantsModule'
import { TenantsModuleConfig } from '../TenantsModuleConfig'

vi.mock('../../../core/src/plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as MockedClassConstructor<typeof DependencyManager>

const dependencyManager = new DependencyManagerMock()

mockFunction(dependencyManager.resolve).mockReturnValue({ logger: { warn: vi.fn() } })

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
})
