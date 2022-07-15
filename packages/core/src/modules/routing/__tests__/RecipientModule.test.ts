import { DependencyManager } from '../../../plugins/DependencyManager'
import { RecipientApi } from '../RecipientApi'
import { RecipientModule } from '../RecipientModule'
import { MediationRepository } from '../repository'
import { MediationRecipientService, RoutingService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('RecipientModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new RecipientModule().register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(RecipientApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediationRecipientService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(RoutingService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MediationRepository)
  })
})
