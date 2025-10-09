import type { MockedClassConstructor } from '../../../../../../tests/types'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { DidsModule } from '../DidsModule'
import { DidsModuleConfig } from '../DidsModuleConfig'
import { DidRepository } from '../repository'
import { DidRegistrarService, DidResolverService } from '../services'

vi.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as MockedClassConstructor<typeof DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('DidsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const didsModule = new DidsModule()
    didsModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(DidsModuleConfig, didsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidResolverService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRegistrarService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRepository)
  })
})
