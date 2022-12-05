import { FeatureRegistry } from '../../../agent/FeatureRegistry'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { MediatorApi } from '../MediatorApi'
import { MediatorModule } from '../MediatorModule'
import {
  MediationRecipientService,
  MediatorService,
  MessagePickupService,
  RoutingService,
  V2MediationRecipientService,
  V2MediatorService,
  V2MessagePickupService,
  V2RoutingService,
  V3MessagePickupService,
} from '../protocol'
import { MediationRepository, MediatorRoutingRepository } from '../repository'
import { MediationService } from '../services/MediationService'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../../agent/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()
describe('MediatorModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new MediatorModule().register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(MediatorApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediationService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MessagePickupService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2MessagePickupService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V3MessagePickupService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(RoutingService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2RoutingService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediatorService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2MediatorService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediationRecipientService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2MediationRecipientService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediationRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediatorRoutingRepository)
  })
})
