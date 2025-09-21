import type { DidCommMessageHandler, DidCommMessageHandlerMiddleware } from './handlers'
import type { DidCommInboundTransport, DidCommOutboundTransport } from './transport'

import { injectable } from '@credo-ts/core'

import { DidCommFeatureRegistry } from './DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommMessageReceiver } from './DidCommMessageReceiver'
import { DidCommMessageSender } from './DidCommMessageSender'
import { DidCommModuleConfig } from './DidCommModuleConfig'

@injectable()
export class DidCommApi {
  public config: DidCommModuleConfig

  private featureRegistry: DidCommFeatureRegistry
  private messageSender: DidCommMessageSender
  private messageReceiver: DidCommMessageReceiver
  private messageHandlerRegistry: DidCommMessageHandlerRegistry

  public constructor(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    messageSender: DidCommMessageSender,
    messageReceiver: DidCommMessageReceiver,
    featureRegistry: DidCommFeatureRegistry,
    config: DidCommModuleConfig
  ) {
    this.messageReceiver = messageReceiver
    this.messageSender = messageSender
    this.featureRegistry = featureRegistry
    this.config = config
    this.messageHandlerRegistry = messageHandlerRegistry
  }

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
}
