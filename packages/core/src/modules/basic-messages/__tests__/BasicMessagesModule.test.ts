import { FeatureRegistry } from '../../../agent/FeatureRegistry'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { BasicMessagesApi } from '../BasicMessagesApi'
import { BasicMessagesModule } from '../BasicMessagesModule'
import { V1BasicMessageProtocol, V2BasicMessageProtocol } from '../protocols'
import { BasicMessageRepository } from '../repository'

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

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V1BasicMessageProtocol)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2BasicMessageProtocol)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(BasicMessageRepository)
  })
})
