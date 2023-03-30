import { DependencyManager } from '../../../plugins/DependencyManager'
import { MessagePickupApi } from '../MessagePickupApi'
import { MessagePickupModule } from '../MessagePickupModule'
import { V1MessagePickupProtocol, V2MessagePickupProtocol } from '../protocol'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('MessagePickupModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new MessagePickupModule().register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(MessagePickupApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V1MessagePickupProtocol)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2MessagePickupProtocol)
  })
})
