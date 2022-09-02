import { DependencyManager } from '../../../plugins/DependencyManager'
import { FeatureRegistry } from '../../discover-features'
import { IndyModule } from '../IndyModule'
import {
  IndyHolderService,
  IndyIssuerService,
  IndyVerifierService,
  IndyRevocationService,
  IndyUtilitiesService,
} from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../discover-features/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()

describe('IndyModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new IndyModule().register(featureRegistry, dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyHolderService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyIssuerService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyRevocationService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyVerifierService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyUtilitiesService)
  })
})
