import { DependencyManager } from '../../../plugins/DependencyManager'
import { DiscoverFeaturesApi } from '../DiscoverFeaturesApi'
import { DiscoverFeaturesModule } from '../DiscoverFeaturesModule'
import { FeatureRegistry } from '../FeatureRegistry'
import { DiscoverFeaturesService } from '../protocol/v1'
import { V2DiscoverFeaturesService } from '../protocol/v2'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

jest.mock('../FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const dependencyManager = new DependencyManagerMock()
const featureRegistry = new FeatureRegistryMock()

describe('DiscoverFeaturesModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DiscoverFeaturesModule().register(featureRegistry, dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(DiscoverFeaturesApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DiscoverFeaturesService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2DiscoverFeaturesService)
  })
})
