import { FeatureRegistry } from '../../../agent/FeatureRegistry'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { BasicMessagesApi } from '../BasicMessagesApi'
import { BasicMessagesModule } from '../BasicMessagesModule'
import { BasicMessageRepository } from '../repository'
import { BasicMessageService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../../agent/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()

describe('BasicMessagesModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new BasicMessagesModule().register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(BasicMessagesApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(BasicMessageService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(BasicMessageRepository)
  })
})
