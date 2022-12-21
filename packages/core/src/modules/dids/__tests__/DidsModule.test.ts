import { DependencyManager } from '../../../plugins/DependencyManager'
import { DidsApi } from '../DidsApi'
import { DidsModule } from '../DidsModule'
import { DidsModuleConfig } from '../DidsModuleConfig'
import { DidRepository } from '../repository'
import { DidRegistrarService, DidResolverService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('DidsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const didsModule = new DidsModule()
    didsModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(DidsApi)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(DidsModuleConfig, didsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidResolverService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRegistrarService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRepository)
  })
})
