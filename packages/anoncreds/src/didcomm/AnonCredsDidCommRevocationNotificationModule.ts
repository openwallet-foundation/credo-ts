import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import { DidCommFeatureRegistry, DidCommMessageHandlerRegistry, DidCommProtocol } from '@credo-ts/didcomm'
import { AnonCredsDidCommRevocationNotificationApi } from './AnonCredsDidCommRevocationNotificationApi'
import { AnonCredsRevocationNotificationProcessor } from './AnonCredsRevocationNotificationProcessor'
import {
  DidCommRevocationNotificationV1Handler,
  DidCommRevocationNotificationV2Handler,
} from './revocation-notification/handlers'
import { DidCommRevocationNotificationService } from './revocation-notification/services'

export class AnonCredsDidCommRevocationNotificationModule implements Module {
  public readonly api = AnonCredsDidCommRevocationNotificationApi

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerContextScoped(AnonCredsDidCommRevocationNotificationApi)
    dependencyManager.registerSingleton(AnonCredsRevocationNotificationProcessor)
    dependencyManager.registerSingleton(DidCommRevocationNotificationService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const messageHandlerRegistry = agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry)
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)
    const service = agentContext.dependencyManager.resolve(DidCommRevocationNotificationService)

    messageHandlerRegistry.registerMessageHandlers([
      new DidCommRevocationNotificationV1Handler(service),
      new DidCommRevocationNotificationV2Handler(service),
    ])
    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/revocation_notification/1.0',
        roles: ['holder'],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/revocation_notification/2.0',
        roles: ['holder'],
      })
    )
  }
}
