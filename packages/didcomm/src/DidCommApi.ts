import type { MessageHandler, MessageHandlerMiddleware } from './handlers'
import type { InboundTransport, OutboundTransport } from './transport'

import { injectable } from '@credo-ts/core'

import { DidCommModuleConfig } from './DidCommModuleConfig'
import { FeatureRegistry } from './FeatureRegistry'
import { MessageHandlerRegistry } from './MessageHandlerRegistry'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'

@injectable()
export class DidCommApi {
  public config: DidCommModuleConfig

  private featureRegistry: FeatureRegistry
  private messageSender: MessageSender
  private messageReceiver: MessageReceiver
  private messageHandlerRegistry: MessageHandlerRegistry

  public constructor(
    messageHandlerRegistry: MessageHandlerRegistry,
    messageSender: MessageSender,
    messageReceiver: MessageReceiver,
    featureRegistry: FeatureRegistry,
    config: DidCommModuleConfig
  ) {
    this.messageReceiver = messageReceiver
    this.messageSender = messageSender
    this.featureRegistry = featureRegistry
    this.config = config
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
}
