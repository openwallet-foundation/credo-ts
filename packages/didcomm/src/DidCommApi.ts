import type { DidCommMessageHandler, DidCommMessageHandlerMiddleware } from './handlers'
import type { DidCommInboundTransport, DidCommOutboundTransport } from './transport'

import { AgentContext, InjectionToken, injectable } from '@credo-ts/core'

import { DidCommFeatureRegistry } from './DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommMessageReceiver } from './DidCommMessageReceiver'
import { DidCommMessageSender } from './DidCommMessageSender'
import { DidCommModuleConfig, DidCommModuleConfigOptions } from './DidCommModuleConfig'
import {
  DefaultDidCommMessagePickupProtocols,
  DefaultDidCommProofProtocols,
  DidCommBasicMessagesApi,
  DidCommConnectionsApi,
  DidCommCredentialProtocol,
  DidCommDiscoverFeaturesApi,
  DidCommMessagePickupApi,
  DidCommMessagePickupModuleConfigOptions,
  DidCommMessagePickupProtocol,
  DidCommOutOfBandApi,
  DidCommProofProtocol,
  DidCommProofsApi,
  DidCommProofsModuleConfigOptions,
} from './modules'
import { DidCommCredentialsApi } from './modules/credentials/DidCommCredentialsApi'
import { DefaultDidCommCredentialProtocols } from './modules/credentials/DidCommCredentialsModule'
import { DidCommCredentialsModuleConfigOptions } from './modules/credentials/DidCommCredentialsModuleConfig'
import { DidCommMediationRecipientApi } from './modules/routing/DidCommMediationRecipientApi'
import { DidCommMediatorApi } from './modules/routing/DidCommMediatorApi'

type ApiOrUndefined<Config, Api> = Config extends false ? never : Api

@injectable()
export class DidCommApi<Options extends DidCommModuleConfigOptions> {
  public connections = this.agentContext.resolve(DidCommConnectionsApi)
  public oob = this.agentContext.resolve(DidCommOutOfBandApi)
  public discovery = this.agentContext.resolve(DidCommDiscoverFeaturesApi)
  public proofs: ApiOrUndefined<
    Options['proofs'],
    DidCommProofsApi<
      Options['proofs'] extends DidCommProofsModuleConfigOptions<DidCommProofProtocol[]>
        ? Options['proofs']['proofProtocols']
        : DefaultDidCommProofProtocols
    >
  > = this.apiOrUndefined(this.config.enabledModules.proofs, DidCommProofsApi)

  public credentials: ApiOrUndefined<
    Options['credentials'],
    DidCommCredentialsApi<
      Options['credentials'] extends DidCommCredentialsModuleConfigOptions<DidCommCredentialProtocol[]>
        ? Options['credentials']['credentialProtocols']
        : DefaultDidCommCredentialProtocols
    >
  > = this.apiOrUndefined(this.config.enabledModules.credentials, DidCommCredentialsApi)

  public messagePickup: ApiOrUndefined<
    Options['messagePickup'],
    DidCommMessagePickupApi<
      Options['messagePickup'] extends DidCommMessagePickupModuleConfigOptions<DidCommMessagePickupProtocol[]>
        ? Options['messagePickup']['protocols']
        : DefaultDidCommMessagePickupProtocols
    >
  > = this.apiOrUndefined(this.config.enabledModules.messagePickup, DidCommMessagePickupApi)

  public basicMessages: ApiOrUndefined<Options['basicMessages'], DidCommBasicMessagesApi> = this.apiOrUndefined(
    this.config.enabledModules.basicMessages,
    DidCommBasicMessagesApi
  )

  public mediator: ApiOrUndefined<Options['mediator'], DidCommMediatorApi> = this.apiOrUndefined(
    this.config.enabledModules.mediator,
    DidCommMediatorApi
  )

  public mediationRecipient: ApiOrUndefined<Options['mediationRecipient'], DidCommMediationRecipientApi> =
    this.apiOrUndefined(this.config.enabledModules.mediationRecipient, DidCommMediationRecipientApi)

  public constructor(
    public agentContext: AgentContext,
    private messageHandlerRegistry: DidCommMessageHandlerRegistry,
    private messageSender: DidCommMessageSender,
    private messageReceiver: DidCommMessageReceiver,
    private featureRegistry: DidCommFeatureRegistry,
    public config: DidCommModuleConfig
  ) {}

  public registerInboundTransport(inboundTransport: DidCommInboundTransport) {
    this.messageReceiver.registerInboundTransport(inboundTransport)
  }

  public async unregisterInboundTransport(inboundTransport: DidCommInboundTransport) {
    await this.messageReceiver.unregisterInboundTransport(inboundTransport)
  }

  public get inboundTransports() {
    return this.messageReceiver.inboundTransports
  }

  public registerOutboundTransport(outboundTransport: DidCommOutboundTransport) {
    this.messageSender.registerOutboundTransport(outboundTransport)
  }

  public async unregisterOutboundTransport(outboundTransport: DidCommOutboundTransport) {
    await this.messageSender.unregisterOutboundTransport(outboundTransport)
  }

  public get outboundTransports() {
    return this.messageSender.outboundTransports
  }

  /**
   * Agent's feature registry
   */
  public registerMessageHandlers(messageHandlers: DidCommMessageHandler[]) {
    for (const messageHandler of messageHandlers) {
      this.messageHandlerRegistry.registerMessageHandler(messageHandler)
    }
  }

  public registerMessageHandlerMiddleware(messageHandlerMiddleware: DidCommMessageHandlerMiddleware) {
    this.messageHandlerRegistry.registerMessageHandlerMiddleware(messageHandlerMiddleware)
  }

  public get fallbackMessageHandler() {
    return this.messageHandlerRegistry.fallbackMessageHandler
  }

  public get messageHandlerMiddlewares() {
    return this.messageHandlerRegistry.messageHandlerMiddlewares
  }

  /**
   * Sets the fallback message handler, the message handler that will be called if no handler
   * is registered for an incoming message type.
   */
  public setFallbackMessageHandler(fallbackMessageHandler: DidCommMessageHandler['handle']) {
    this.messageHandlerRegistry.setFallbackMessageHandler(fallbackMessageHandler)
  }

  public get features() {
    return this.featureRegistry
  }

  private apiOrUndefined(isEnabled: boolean, apiClass: InjectionToken) {
    if (isEnabled) {
      return this.agentContext.resolve(apiClass)
    }

    return undefined
  }
}
