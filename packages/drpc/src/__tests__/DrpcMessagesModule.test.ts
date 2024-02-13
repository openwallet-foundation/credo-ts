import { FeatureRegistry } from '../../../core/src/agent/FeatureRegistry'
import { DependencyManager } from '../../../core/src/plugins/DependencyManager'
import { DrpcModule } from '../DrpcModule'
import { DrpcMessageRepository } from '../repository'
import { DrpcService } from '../services'

jest.mock('../../../core/src/plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../../core/src/agent/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()

describe('DrpcModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DrpcModule().register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DrpcService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DrpcMessageRepository)
  })
})
