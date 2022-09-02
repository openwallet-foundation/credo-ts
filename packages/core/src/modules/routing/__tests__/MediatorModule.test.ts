import { DependencyManager } from '../../../plugins/DependencyManager'
import { FeatureRegistry } from '../../discover-features'
import { MediatorApi } from '../MediatorApi'
import { MediatorModule } from '../MediatorModule'
import { MessagePickupService, V2MessagePickupService } from '../protocol'
import { MediationRepository, MediatorRoutingRepository } from '../repository'
import { MediatorService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../discover-features/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()
describe('MediatorModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new MediatorModule().register(featureRegistry, dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(MediatorApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediatorService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MessagePickupService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2MessagePickupService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediationRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediatorRoutingRepository)
  })
})
