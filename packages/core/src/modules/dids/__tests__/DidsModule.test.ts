import { DependencyManager } from '../../../plugins/DependencyManager'
import { DidsApi } from '../DidsApi'
import { DidsModule } from '../DidsModule'
import { DidRepository } from '../repository'
import { DidResolverService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('DidsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DidsModule().register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(DidsApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidResolverService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRepository)
  })
})
