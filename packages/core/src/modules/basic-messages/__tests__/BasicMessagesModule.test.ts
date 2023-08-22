import { FeatureRegistry } from '../../../agent/FeatureRegistry'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { BasicMessagesApi } from '../BasicMessagesApi'
import { BasicMessagesModule } from '../BasicMessagesModule'
import { BasicMessagesModuleConfig } from '../BasicMessagesModuleConfig'
import { BasicMessageRepository } from '../repository'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../../agent/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()

describe('BasicMessagesModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const module = new BasicMessagesModule()
    module.register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(BasicMessagesApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(BasicMessageRepository)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(BasicMessagesModuleConfig, module.config)
  })
})
