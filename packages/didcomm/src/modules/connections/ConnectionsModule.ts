import {
  type AgentContext,
  type DependencyManager,
  DidRepository,
  DidResolverService,
  type Module,
} from '@credo-ts/core'
import type { ConnectionsModuleConfigOptions } from './ConnectionsModuleConfig'

import { FeatureRegistry } from '../../FeatureRegistry'
import { Protocol } from '../../models'

import { MessageHandlerRegistry } from '../../MessageHandlerRegistry'
import { OutOfBandService } from '../oob'
import { RoutingService } from '../routing'
import { ConnectionsApi } from './ConnectionsApi'
import { ConnectionsModuleConfig } from './ConnectionsModuleConfig'
import { DidExchangeProtocol } from './DidExchangeProtocol'
import {
  AckMessageHandler,
  ConnectionProblemReportHandler,
  ConnectionRequestHandler,
  ConnectionResponseHandler,
  DidExchangeCompleteHandler,
  DidExchangeRequestHandler,
  DidExchangeResponseHandler,
  DidRotateAckHandler,
  DidRotateHandler,
  DidRotateProblemReportHandler,
  HangupHandler,
  TrustPingMessageHandler,
  TrustPingResponseMessageHandler,
} from './handlers'
import { ConnectionRole, DidExchangeRole, DidRotateRole } from './models'
import { ConnectionRepository } from './repository'
import { ConnectionService, DidRotateService, TrustPingService } from './services'

export class ConnectionsModule implements Module {
  public readonly config: ConnectionsModuleConfig
  public readonly api = ConnectionsApi

  public constructor(config?: ConnectionsModuleConfigOptions) {
    this.config = new ConnectionsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the connections module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(ConnectionsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(ConnectionService)
    dependencyManager.registerSingleton(DidExchangeProtocol)
    dependencyManager.registerSingleton(DidRotateService)
    dependencyManager.registerSingleton(TrustPingService)

    // Repositories
    dependencyManager.registerSingleton(ConnectionRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // Features
    const featureRegistry = agentContext.resolve(FeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(MessageHandlerRegistry)

    const connectionService = agentContext.resolve(ConnectionService)
    const outOfBandService = agentContext.resolve(OutOfBandService)
    const routingService = agentContext.resolve(RoutingService)
    const didRepository = agentContext.resolve(DidRepository)
    const didResolverService = agentContext.resolve(DidResolverService)
    const trustPingService = agentContext.resolve(TrustPingService)
    const didExchangeProtocol = agentContext.resolve(DidExchangeProtocol)
    const didRotateService = agentContext.resolve(DidRotateService)

    messageHandlerRegistry.registerMessageHandler(
      new ConnectionRequestHandler(connectionService, outOfBandService, routingService, didRepository, this.config)
    )
    messageHandlerRegistry.registerMessageHandler(
      new ConnectionResponseHandler(connectionService, outOfBandService, didResolverService, this.config)
    )
    messageHandlerRegistry.registerMessageHandler(new AckMessageHandler(connectionService))
    messageHandlerRegistry.registerMessageHandler(new ConnectionProblemReportHandler(connectionService))
    messageHandlerRegistry.registerMessageHandler(new TrustPingMessageHandler(trustPingService, connectionService))
    messageHandlerRegistry.registerMessageHandler(new TrustPingResponseMessageHandler(trustPingService))
    messageHandlerRegistry.registerMessageHandler(
      new DidExchangeRequestHandler(didExchangeProtocol, outOfBandService, routingService, didRepository, this.config)
    )
    messageHandlerRegistry.registerMessageHandler(
      new DidExchangeResponseHandler(
        didExchangeProtocol,
        outOfBandService,
        connectionService,
        didResolverService,
        this.config
      )
    )
    messageHandlerRegistry.registerMessageHandler(new DidExchangeCompleteHandler(didExchangeProtocol, outOfBandService))
    messageHandlerRegistry.registerMessageHandler(new DidRotateHandler(didRotateService, connectionService))
    messageHandlerRegistry.registerMessageHandler(new DidRotateAckHandler(didRotateService))
    messageHandlerRegistry.registerMessageHandler(new HangupHandler(didRotateService))
    messageHandlerRegistry.registerMessageHandler(new DidRotateProblemReportHandler(didRotateService))

    featureRegistry.register(
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
      })
    )
  }
}
