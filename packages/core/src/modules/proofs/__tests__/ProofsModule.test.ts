import { DependencyManager } from '../../../plugins/DependencyManager'
import { ProofsApi } from '../ProofsApi'
import { ProofsModule } from '../ProofsModule'
import { ProofRepository } from '../repository'
import { ProofService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('ProofsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new ProofsModule().register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(ProofsApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ProofService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ProofRepository)
  })
})
