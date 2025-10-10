import type { MockedClassConstructor } from '../../../../../../tests/types'
import { DependencyManager } from '../../../../../core/src/plugins/DependencyManager'
import { DidCommMediationRecipientModule } from '../DidCommMediationRecipientModule'
import { DidCommMediationRepository } from '../repository'
import { DidCommMediationRecipientService, DidCommRoutingService } from '../services'

vi.mock('../../../../../core/src/plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as MockedClassConstructor<typeof DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('DidCommMediationRecipientModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new DidCommMediationRecipientModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommMediationRecipientService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommRoutingService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommMediationRepository)
  })
})
