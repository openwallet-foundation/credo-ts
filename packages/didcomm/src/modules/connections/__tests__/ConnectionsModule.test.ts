import type { DependencyManager } from '../../../../../core/src/plugins/DependencyManager'

import { getAgentContext } from '../../../../../core/tests'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommProtocol } from '../../../models'
import { ConnectionsModule } from '../ConnectionsModule'
import { ConnectionsModuleConfig } from '../ConnectionsModuleConfig'
import { DidExchangeProtocol } from '../DidExchangeProtocol'
import { ConnectionRole, DidExchangeRole, DidRotateRole } from '../models'
import { ConnectionRepository } from '../repository'
import { ConnectionService, TrustPingService } from '../services'
import { DidRotateService } from '../services/DidRotateService'

describe('ConnectionsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const dependencyManager = {
      registerInstance: jest.fn(),
      registerSingleton: jest.fn(),
      registerContextScoped: jest.fn(),
    } as unknown as DependencyManager

    const connectionsModule = new ConnectionsModule()
    connectionsModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(ConnectionsModuleConfig, connectionsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ConnectionService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidExchangeProtocol)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(TrustPingService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidRotateService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ConnectionRepository)
  })

  test('registers features on the feature registry', async () => {
    const featureRegistry = new DidCommFeatureRegistry()
    const agentContext = getAgentContext({ registerInstances: [[DidCommFeatureRegistry, featureRegistry]] })
    await new ConnectionsModule().initialize(agentContext)

    expect(featureRegistry.query({ featureType: 'protocol', match: '*' })).toEqual([
      new DidCommProtocol({
        id: 'https://didcomm.org/connections/1.0',
        roles: [ConnectionRole.Invitee, ConnectionRole.Inviter],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/didexchange/1.1',
        roles: [DidExchangeRole.Requester, DidExchangeRole.Responder],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/did-rotate/1.0',
        roles: [DidRotateRole.RotatingParty, DidRotateRole.ObservingParty],
      }),
    ])
  })
})
