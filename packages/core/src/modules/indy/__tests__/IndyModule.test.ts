import { DependencyManager } from '../../../plugins/DependencyManager'
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

describe('IndyModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new IndyModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyHolderService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyIssuerService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyRevocationService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyVerifierService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyUtilitiesService)
  })
})
