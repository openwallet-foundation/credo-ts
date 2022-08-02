import { DependencyManager } from '../../../plugins/DependencyManager'
import { DiscoverFeaturesApi } from '../DiscoverFeaturesApi'
import { DiscoverFeaturesModule } from '../DiscoverFeaturesModule'
import { DiscoverFeaturesService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('DiscoverFeaturesModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DiscoverFeaturesModule().register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(DiscoverFeaturesApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DiscoverFeaturesService)
  })
})
