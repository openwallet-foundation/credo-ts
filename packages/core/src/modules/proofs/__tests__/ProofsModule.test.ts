import { DependencyManager } from '../../../plugins/DependencyManager'
import { RevocationNotificationService } from '../../credentials/protocol/revocation-notification/services'
import { ProofsApi } from '../ProofsApi'
import { ProofsModule } from '../ProofsModule'
import { V1ProofService } from '../protocol/v1/V1ProofService'
import { V2ProofService } from '../protocol/v2/V2ProofService'
import { ProofRepository } from '../repository'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('ProofsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new ProofsModule().register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(ProofsApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V1ProofService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2ProofService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(RevocationNotificationService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ProofRepository)
  })
})
