import {
  type AgentContext,
  type DependencyManager,
  DidRepository,
  DidResolverService,
  type Module,
} from '@credo-ts/core'
import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommProtocol } from '../../models'
import { DidCommOutOfBandService } from '../oob/DidCommOutOfBandService'
import { DidCommRoutingService } from '../routing/services/DidCommRoutingService'
import { DidCommConnectionsApi } from './DidCommConnectionsApi'
import type { DidCommConnectionsModuleConfigOptions } from './DidCommConnectionsModuleConfig'
import { DidCommConnectionsModuleConfig } from './DidCommConnectionsModuleConfig'
import { DidExchangeProtocol } from './DidExchangeProtocol'
import {
  DidCommAckMessageHandler,
  DidCommConnectionProblemReportHandler,
  DidCommConnectionRequestHandler,
  DidCommConnectionResponseHandler,
  DidCommDidExchangeCompleteHandler,
  DidCommDidExchangeRequestHandler,
  DidCommDidExchangeResponseHandler,
  DidCommDidRotateAckHandler,
  DidCommDidRotateHandler,
  DidCommDidRotateProblemReportHandler,
  DidCommHangupHandler,
  DidCommTrustPingMessageHandler,
  DidCommTrustPingResponseMessageHandler,
} from './handlers'
import { DidCommConnectionRole, DidCommDidExchangeRole, DidCommDidRotateRole } from './models'
import { DidCommConnectionRepository } from './repository'
import { DidCommConnectionService } from './services/DidCommConnectionService'
import { DidCommDidRotateService } from './services/DidCommDidRotateService'
import { DidCommTrustPingService } from './services/DidCommTrustPingService'

export class DidCommConnectionsModule implements Module {
  public readonly config: DidCommConnectionsModuleConfig
  public readonly api = DidCommConnectionsApi

  public constructor(config?: DidCommConnectionsModuleConfigOptions) {
    this.config = new DidCommConnectionsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the connections module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommConnectionsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(DidCommConnectionService)
    dependencyManager.registerSingleton(DidExchangeProtocol)
    dependencyManager.registerSingleton(DidCommDidRotateService)
    dependencyManager.registerSingleton(DidCommTrustPingService)

    // Repositories
    dependencyManager.registerSingleton(DidCommConnectionRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // Features
    const featureRegistry = agentContext.resolve(DidCommFeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(DidCommMessageHandlerRegistry)

    const connectionService = agentContext.resolve(DidCommConnectionService)
    const outOfBandService = agentContext.resolve(DidCommOutOfBandService)
    const routingService = agentContext.resolve(DidCommRoutingService)
    const didRepository = agentContext.resolve(DidRepository)
    const didResolverService = agentContext.resolve(DidResolverService)
    const trustPingService = agentContext.resolve(DidCommTrustPingService)
    const didExchangeProtocol = agentContext.resolve(DidExchangeProtocol)
    const didRotateService = agentContext.resolve(DidCommDidRotateService)

    messageHandlerRegistry.registerMessageHandler(
      new DidCommConnectionRequestHandler(
        connectionService,
        outOfBandService,
        routingService,
        didRepository,
        this.config
      )
    )
    messageHandlerRegistry.registerMessageHandler(
      new DidCommConnectionResponseHandler(connectionService, outOfBandService, didResolverService, this.config)
    )
    messageHandlerRegistry.registerMessageHandler(new DidCommAckMessageHandler(connectionService))
    messageHandlerRegistry.registerMessageHandler(new DidCommConnectionProblemReportHandler(connectionService))
    messageHandlerRegistry.registerMessageHandler(
      new DidCommTrustPingMessageHandler(trustPingService, connectionService)
    )
    messageHandlerRegistry.registerMessageHandler(new DidCommTrustPingResponseMessageHandler(trustPingService))
    messageHandlerRegistry.registerMessageHandler(
      new DidCommDidExchangeRequestHandler(
        didExchangeProtocol,
        outOfBandService,
        routingService,
        didRepository,
        this.config
      )
    )
    messageHandlerRegistry.registerMessageHandler(
      new DidCommDidExchangeResponseHandler(
        didExchangeProtocol,
        outOfBandService,
        connectionService,
        didResolverService,
        this.config
      )
    )
    messageHandlerRegistry.registerMessageHandler(
      new DidCommDidExchangeCompleteHandler(didExchangeProtocol, outOfBandService)
    )
    messageHandlerRegistry.registerMessageHandler(new DidCommDidRotateHandler(didRotateService, connectionService))
    messageHandlerRegistry.registerMessageHandler(new DidCommDidRotateAckHandler(didRotateService))
    messageHandlerRegistry.registerMessageHandler(new DidCommHangupHandler(didRotateService))
    messageHandlerRegistry.registerMessageHandler(new DidCommDidRotateProblemReportHandler(didRotateService))

    featureRegistry.register(
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
      })
    )
  }
}
