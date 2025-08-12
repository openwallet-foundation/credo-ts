import { DependencyManager } from '../../../../../core/src/plugins/DependencyManager'
import { DidCommMediatorModule } from '../DidCommMediatorModule'
import { DidCommMediationRepository, DidCommMediatorRoutingRepository } from '../repository'
import { DidCommMediatorService } from '../services'

jest.mock('../../../../../core/src/plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('DidCommMediatorModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DidCommMediatorModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommMediatorService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommMediationRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommMediatorRoutingRepository)
  })
})
