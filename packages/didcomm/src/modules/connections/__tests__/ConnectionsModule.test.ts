import { DidRepository, DidResolverService } from '@credo-ts/core'
import type { DependencyManager } from '../../../../../core/src/plugins/DependencyManager'

import { getAgentContext } from '../../../../../core/tests'
import { FeatureRegistry } from '../../../FeatureRegistry'
import { MessageHandlerRegistry } from '../../../MessageHandlerRegistry'
import { Protocol } from '../../../models'
import { OutOfBandService } from '../../oob'
import { RoutingService } from '../../routing'
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
    const featureRegistry = new FeatureRegistry()
    const messageHandlerRegistry = new MessageHandlerRegistry()
    const agentContext = getAgentContext({
      registerInstances: [
        [FeatureRegistry, featureRegistry],
        [MessageHandlerRegistry, messageHandlerRegistry],
        [ConnectionService, {} as ConnectionService],
        [OutOfBandService, {} as OutOfBandService],
        [RoutingService, {} as RoutingService],
        [DidRepository, {} as DidRepository],
        [DidResolverService, {} as DidResolverService],
        [TrustPingService, {} as TrustPingService],
        [DidExchangeProtocol, {} as DidExchangeProtocol],
        [DidRotateService, {} as DidRotateService],
      ],
    })
    await new ConnectionsModule().initialize(agentContext)

    expect(featureRegistry.query({ featureType: 'protocol', match: '*' })).toEqual([
      new Protocol({
        id: 'https://didcomm.org/connections/1.0',
        roles: [ConnectionRole.Invitee, ConnectionRole.Inviter],
      }),
      new Protocol({
        id: 'https://didcomm.org/didexchange/1.1',
        roles: [DidExchangeRole.Requester, DidExchangeRole.Responder],
      }),
      new Protocol({
        id: 'https://didcomm.org/did-rotate/1.0',
        roles: [DidRotateRole.RotatingParty, DidRotateRole.ObservingParty],
      }),
    ])
  })
})
