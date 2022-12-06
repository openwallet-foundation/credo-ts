import { FeatureRegistry } from '../../../agent/FeatureRegistry'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { ProofsApi } from '../ProofsApi'
import { ProofsModule } from '../ProofsModule'
import { V1ProofService } from '../protocol/v1/V1ProofService'
import { V2ProofService } from '../protocol/v2/V2ProofService'
import { ProofRepository } from '../repository'

jest.mock('../../../plugins/DependencyManager')
jest.mock('../../../agent/FeatureRegistry')

const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>
const dependencyManager = new DependencyManagerMock()
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>
const featureRegistry = new FeatureRegistryMock()

describe('ProofsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new ProofsModule().register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(ProofsApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V1ProofService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2ProofService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ProofRepository)

    expect(featureRegistry.register).toHaveBeenCalledTimes(2)
  })
})
