import { FeatureRegistry } from '../../../agent/FeatureRegistry'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { DRPCMessagesModule } from '../DRPCMessagesModule'
import { DRPCMessageRepository } from '../repository'
import { DRPCMessageService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../../agent/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()

describe('DRPCMessagesModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DRPCMessagesModule().register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DRPCMessageService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DRPCMessageRepository)
  })
})
