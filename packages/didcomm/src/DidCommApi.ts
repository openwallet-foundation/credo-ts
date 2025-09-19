import type { MessageHandler, MessageHandlerMiddleware } from './handlers'
import type { InboundTransport, OutboundTransport } from './transport'

import { AgentContext, InjectionToken, injectable } from '@credo-ts/core'

import { DidCommModuleConfig, DidCommModuleConfigOptions } from './DidCommModuleConfig'
import { FeatureRegistry } from './FeatureRegistry'
import { MessageHandlerRegistry } from './MessageHandlerRegistry'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import {
  BasicMessagesApi,
  ConnectionsApi,
  CredentialProtocol,
  CredentialsApi,
  CredentialsModuleConfigOptions,
  DefaultCredentialProtocols,
  DefaultMessagePickupProtocols,
  DefaultProofProtocols,
  DiscoverFeaturesApi,
  MediationRecipientApi,
  MediatorApi,
  MessagePickupApi,
  MessagePickupModuleConfigOptions,
  MessagePickupProtocol,
  OutOfBandApi,
  ProofProtocol,
  ProofsApi,
  ProofsModuleConfigOptions,
} from './modules'

type ApiOrUndefined<Config, Api> = Config extends false ? never : Api

@injectable()
export class DidCommApi<Options extends DidCommModuleConfigOptions> {
  private featureRegistry: FeatureRegistry
  private messageSender: MessageSender
  private messageReceiver: MessageReceiver
  private messageHandlerRegistry: MessageHandlerRegistry

  public connections = this.agentContext.resolve(ConnectionsApi)
  public oob = this.agentContext.resolve(OutOfBandApi)
  public discovery = this.agentContext.resolve(DiscoverFeaturesApi)
  public proofs: ApiOrUndefined<
    Options['proofs'],
    ProofsApi<
      Options['proofs'] extends ProofsModuleConfigOptions<ProofProtocol[]>
        ? Options['proofs']['proofProtocols']
        : DefaultProofProtocols
    >
  > = this.apiOrUndefined(this.config.enabledModules.proofs, ProofsApi)

  public credentials: ApiOrUndefined<
    Options['credentials'],
    CredentialsApi<
      Options['credentials'] extends CredentialsModuleConfigOptions<CredentialProtocol[]>
        ? Options['credentials']['credentialProtocols']
        : DefaultCredentialProtocols
    >
  > = this.apiOrUndefined(this.config.enabledModules.credentials, CredentialsApi)

  public messagePickup: ApiOrUndefined<
    Options['messagePickup'],
    MessagePickupApi<
      Options['messagePickup'] extends MessagePickupModuleConfigOptions<MessagePickupProtocol[]>
        ? Options['messagePickup']['protocols']
        : DefaultMessagePickupProtocols
    >
  > = this.apiOrUndefined(this.config.enabledModules.messagePickup, MessagePickupApi)

  public basicMessages: ApiOrUndefined<Options['basicMessages'], BasicMessagesApi> = this.apiOrUndefined(
    this.config.enabledModules.basicMessages,
    BasicMessagesApi
  )

  public mediator: ApiOrUndefined<Options['mediator'], MediatorApi> = this.apiOrUndefined(
    this.config.enabledModules.mediator,
    MediatorApi
  )

  public mediationRecipient: ApiOrUndefined<Options['mediationRecipient'], MediationRecipientApi> = this.apiOrUndefined(
    this.config.enabledModules.mediationRecipient,
    MediationRecipientApi
  )

  public constructor(
    messageHandlerRegistry: MessageHandlerRegistry,
    messageSender: MessageSender,
    messageReceiver: MessageReceiver,
    featureRegistry: FeatureRegistry,
    public config: DidCommModuleConfig<Options>,
    private agentContext: AgentContext
  ) {
    this.messageReceiver = messageReceiver
    this.messageSender = messageSender
    this.featureRegistry = featureRegistry
    this.messageHandlerRegistry = messageHandlerRegistry
  }

  public registerInboundTransport(inboundTransport: InboundTransport) {
    this.messageReceiver.registerInboundTransport(inboundTransport)
  }

  public async unregisterInboundTransport(inboundTransport: InboundTransport) {
    await this.messageReceiver.unregisterInboundTransport(inboundTransport)
  }

  public get inboundTransports() {
    return this.messageReceiver.inboundTransports
  }

  public registerOutboundTransport(outboundTransport: OutboundTransport) {
    this.messageSender.registerOutboundTransport(outboundTransport)
  }

  public async unregisterOutboundTransport(outboundTransport: OutboundTransport) {
    await this.messageSender.unregisterOutboundTransport(outboundTransport)
  }

  public get outboundTransports() {
    return this.messageSender.outboundTransports
  }

  /**
   * Agent's feature registry
   */
  public registerMessageHandlers(messageHandlers: MessageHandler[]) {
    for (const messageHandler of messageHandlers) {
      this.messageHandlerRegistry.registerMessageHandler(messageHandler)
    }
  }

  public registerMessageHandlerMiddleware(messageHandlerMiddleware: MessageHandlerMiddleware) {
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
  public setFallbackMessageHandler(fallbackMessageHandler: MessageHandler['handle']) {
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
