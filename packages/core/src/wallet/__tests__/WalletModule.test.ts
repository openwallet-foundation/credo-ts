import { FeatureRegistry } from '../../modules/discover-features'
import { DependencyManager } from '../../plugins/DependencyManager'
import { WalletApi } from '../WalletApi'
import { WalletModule } from '../WalletModule'

jest.mock('../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

jest.mock('../../modules/discover-features/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()

describe('WalletModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new WalletModule().register(featureRegistry, dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(WalletApi)
  })
})
