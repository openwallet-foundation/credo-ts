import { AgentContext, type InjectionToken, injectable } from '@credo-ts/core'
import { DidCommFeatureRegistry } from './DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommModuleConfig, type DidCommModuleConfigOptions } from './DidCommModuleConfig'
import type { DidCommMessageHandler, DidCommMessageHandlerMiddleware } from './handlers'
import {
  type DefaultDidCommMessagePickupProtocols,
  type DefaultDidCommProofProtocols,
  DidCommBasicMessagesApi,
  DidCommConnectionsApi,
  type DidCommCredentialProtocol,
  DidCommDiscoverFeaturesApi,
  DidCommMessagePickupApi,
  type DidCommMessagePickupModuleConfigOptions,
  type DidCommMessagePickupProtocol,
  DidCommOutOfBandApi,
  type DidCommProofProtocol,
  DidCommProofsApi,
  type DidCommProofsModuleConfigOptions,
} from './modules'
import { DidCommCredentialsApi } from './modules/credentials/DidCommCredentialsApi'
import type { DefaultDidCommCredentialProtocols } from './modules/credentials/DidCommCredentialsModule'
import type { DidCommCredentialsModuleConfigOptions } from './modules/credentials/DidCommCredentialsModuleConfig'
import { DidCommMediationRecipientApi } from './modules/routing/DidCommMediationRecipientApi'
import { DidCommMediatorApi } from './modules/routing/DidCommMediatorApi'
import type { DidCommInboundTransport, DidCommOutboundTransport } from './transport'

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
    private featureRegistry: DidCommFeatureRegistry,
    public config: DidCommModuleConfig
  ) {}

  public registerInboundTransport(inboundTransport: DidCommInboundTransport) {
    this.config.inboundTransports.push(inboundTransport)
  }

  public async unregisterInboundTransport(inboundTransport: DidCommInboundTransport) {
    this.config.inboundTransports = this.config.inboundTransports.filter((transport) => transport !== inboundTransport)
    await inboundTransport.stop()
  }

  public get inboundTransports() {
    return this.config.inboundTransports
  }

  public registerOutboundTransport(outboundTransport: DidCommOutboundTransport) {
    this.config.outboundTransports.push(outboundTransport)
  }

  public async unregisterOutboundTransport(outboundTransport: DidCommOutboundTransport) {
    this.config.outboundTransports = this.config.outboundTransports.filter(
      (transport) => transport !== outboundTransport
    )
  }

  public get outboundTransports() {
    return this.config.outboundTransports
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
