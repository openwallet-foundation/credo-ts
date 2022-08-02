import { DependencyManager } from '../../../plugins/DependencyManager'
import { ConnectionsApi } from '../ConnectionsApi'
import { ConnectionsModule } from '../ConnectionsModule'
import { ConnectionsModuleConfig } from '../ConnectionsModuleConfig'
import { DidExchangeProtocol } from '../DidExchangeProtocol'
import { ConnectionRepository } from '../repository'
import { ConnectionService, TrustPingService } from '../services'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('ConnectionsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const connectionsModule = new ConnectionsModule()
    connectionsModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(ConnectionsApi)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(ConnectionsModuleConfig, connectionsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(4)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ConnectionService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidExchangeProtocol)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TrustPingService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ConnectionRepository)
  })
})
