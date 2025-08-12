import type { DependencyManager } from '../../../../../core/src/plugins/DependencyManager'

import { getAgentContext } from '../../../../../core/tests'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommProtocol } from '../../../models'
import { DidCommConnectionsModule } from '../DidCommConnectionsModule'
import { DidCommConnectionsModuleConfig } from '../DidCommConnectionsModuleConfig'
import { DidExchangeProtocol } from '../DidExchangeProtocol'
import { DidCommConnectionRole, DidCommDidExchangeRole, DidCommDidRotateRole } from '../models'
import { DidCommConnectionRepository } from '../repository'
import { DidCommConnectionService, DidCommTrustPingService } from '../services'
import { DidCommDidRotateService } from '../services/DidCommDidRotateService'

describe('DidCommConnectionsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const dependencyManager = {
      registerInstance: jest.fn(),
      registerSingleton: jest.fn(),
      registerContextScoped: jest.fn(),
    } as unknown as DependencyManager

    const connectionsModule = new DidCommConnectionsModule()
    connectionsModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(DidCommConnectionsModuleConfig, connectionsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommConnectionService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidExchangeProtocol)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommTrustPingService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommDidRotateService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommConnectionRepository)
  })

  test('registers features on the feature registry', async () => {
    const featureRegistry = new DidCommFeatureRegistry()
    const agentContext = getAgentContext({ registerInstances: [[DidCommFeatureRegistry, featureRegistry]] })
    await new DidCommConnectionsModule().initialize(agentContext)

    expect(featureRegistry.query({ featureType: 'protocol', match: '*' })).toEqual([
      new DidCommProtocol({
        id: 'https://didcomm.org/connections/1.0',
        roles: [DidCommConnectionRole.Invitee, DidCommConnectionRole.Inviter],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/didexchange/1.1',
        roles: [DidCommDidExchangeRole.Requester, DidCommDidExchangeRole.Responder],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/did-rotate/1.0',
        roles: [DidCommDidRotateRole.RotatingParty, DidCommDidRotateRole.ObservingParty],
      }),
    ])
  })
})
