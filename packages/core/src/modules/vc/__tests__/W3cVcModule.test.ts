import { DependencyManager } from '../../../plugins/DependencyManager'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cVcModule } from '../W3cVcModule'
import { W3cCredentialRepository } from '../repository'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('W3cVcModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new W3cVcModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cCredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cCredentialRepository)
  })
})
