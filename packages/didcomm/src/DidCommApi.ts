import type { DidCommMessageHandler, DidCommMessageHandlerMiddleware } from './handlers'
import type { DidCommInboundTransport, DidCommOutboundTransport } from './transport'

import { injectable } from '@credo-ts/core'

import { DidCommFeatureRegistry } from './DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommModuleConfig } from './DidCommModuleConfig'

@injectable()
export class DidCommApi {
  public config: DidCommModuleConfig

  private featureRegistry: DidCommFeatureRegistry
  private messageHandlerRegistry: DidCommMessageHandlerRegistry

  public constructor(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    featureRegistry: DidCommFeatureRegistry,
    config: DidCommModuleConfig
  ) {
    this.featureRegistry = featureRegistry
    this.config = config
    this.messageHandlerRegistry = messageHandlerRegistry
  }

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
}
