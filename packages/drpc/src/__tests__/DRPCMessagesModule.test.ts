import { FeatureRegistry } from '../../../core/src/agent/FeatureRegistry'
import { DependencyManager } from '../../../core/src/plugins/DependencyManager'
import { DRPCMessagesModule } from '../DRPCMessagesModule'
import { DRPCMessageRepository } from '../repository'
import { DRPCMessageService } from '../services'

jest.mock('../../../core/src/plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../../core/src/agent/FeatureRegistry')
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
