import { DependencyManager } from '../../../../../core/src/plugins/DependencyManager'
import { DidCommOutOfBandModule } from '../DidCommOutOfBandModule'
import { DidCommOutOfBandService } from '../DidCommOutOfBandService'
import { DidCommOutOfBandRepository } from '../repository/DidCommOutOfBandRepository'

jest.mock('../../../../../core/src/plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('DidCommOutOfBandModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DidCommOutOfBandModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommOutOfBandService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommOutOfBandRepository)
  })
})
