import type { AgentMessageReceivedEvent } from './Events'
import type { MessageHandler, MessageHandlerMiddleware } from './handlers'
import type { InboundTransport, OutboundTransport } from './transport'
import type { Subject, Subscription } from 'rxjs'

import { mergeMap, takeUntil } from 'rxjs'

import { AgentContext } from '../../agent'
import { EventEmitter } from '../../agent/EventEmitter'
import { InjectionSymbols } from '../../constants'
import { CredoError } from '../../error'
import { injectable } from '../../plugins'

import { DidCommModuleConfig } from './DidCommModuleConfig'
import { AgentEventTypes } from './Events'
import { FeatureRegistry } from './FeatureRegistry'
import { MessageHandlerRegistry } from './MessageHandlerRegistry'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { ConnectionsApi } from './connections'
import { OutOfBandApi } from './oob'
import { MediationRecipientApi } from './routing'
import { ConnectionService } from './services/connections'

@injectable()
export class DidCommApi {
  public config: DidCommModuleConfig

  private eventEmitter: EventEmitter
  private featureRegistry: FeatureRegistry
  private messageSender: MessageSender
  private messageReceiver: MessageReceiver
  private agentContext: AgentContext
  private messageSubscription?: Subscription
  private mediationRecipient: MediationRecipientApi
  private connections: ConnectionsApi
  private oob: OutOfBandApi
  private messageHandlerRegistry: MessageHandlerRegistry

  public constructor(
    eventEmitter: EventEmitter,
    messageHandlerRegistry: MessageHandlerRegistry,
    messageSender: MessageSender,
    messageReceiver: MessageReceiver,
    featureRegistry: FeatureRegistry,
    agentContext: AgentContext,
    config: DidCommModuleConfig,
    mediationRecipient: MediationRecipientApi,
    connections: ConnectionsApi,
    oob: OutOfBandApi
  ) {
    this.eventEmitter = eventEmitter
    this.messageReceiver = messageReceiver
    this.messageSender = messageSender
    this.featureRegistry = featureRegistry
    this.agentContext = agentContext
    this.config = config
    this.mediationRecipient = mediationRecipient
    this.connections = connections
    this.oob = oob
    this.messageHandlerRegistry = messageHandlerRegistry
  }

  public async initialize() {
    const stop$ = this.agentContext.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)

    // Listen for new messages (either from transports or somewhere else in the framework / extensions)
    // We create this before doing any other initialization, so the initialization could already receive messages
    this.messageSubscription = this.eventEmitter
      .observable<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived)
      .pipe(
        takeUntil(stop$),
        mergeMap(
          (e) =>
            this.messageReceiver
              .receiveMessage(e.payload.message, {
                connection: e.payload.connection,
                contextCorrelationId: e.payload.contextCorrelationId,
                session: e.payload.session,
              })
              .catch((error) => {
                this.agentContext.config.logger.error('Failed to process message', { error })
              }),
          this.config.processDidCommMessagesConcurrently ? undefined : 1
        )
      )
      .subscribe()

    for (const transport of this.inboundTransports) {
      await transport.start(this.agentContext)
    }

    for (const transport of this.outboundTransports) {
      await transport.start(this.agentContext)
    }

    // Connect to mediator through provided invitation if provided in config
    // Also requests mediation ans sets as default mediator
    // Because this requires the connections module, we do this in the agent constructor
    if (this.mediationRecipient.config.mediatorInvitationUrl) {
      this.agentContext.config.logger.debug('Provision mediation with invitation', {
        mediatorInvitationUrl: this.mediationRecipient.config.mediatorInvitationUrl,
      })
      const mediationConnection = await this.getMediationConnection(
        this.mediationRecipient.config.mediatorInvitationUrl
      )
      await this.mediationRecipient.provision(mediationConnection)
    }

    await this.mediationRecipient.initialize()
  }

  public async shutdown() {
    // Stop transports
    const allTransports = [...this.inboundTransports, ...this.outboundTransports]
    const transportPromises = allTransports.map((transport) => transport.stop())
    await Promise.all(transportPromises)
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

  protected async getMediationConnection(mediatorInvitationUrl: string) {
    const outOfBandInvitation = await this.oob.parseInvitation(mediatorInvitationUrl)

    const outOfBandRecord = await this.oob.findByReceivedInvitationId(outOfBandInvitation.id)
    const [connection] = outOfBandRecord ? await this.connections.findAllByOutOfBandId(outOfBandRecord.id) : []

    if (!connection) {
      this.agentContext.config.logger.debug('Mediation connection does not exist, creating connection')
      // We don't want to use the current default mediator when connecting to another mediator
      const routing = await this.mediationRecipient.getRouting({ useDefaultMediator: false })

      this.agentContext.config.logger.debug('Routing created', routing)
      const { connectionRecord: newConnection } = await this.oob.receiveInvitation(outOfBandInvitation, {
        routing,
      })
      this.agentContext.config.logger.debug(`Mediation invitation processed`, { outOfBandInvitation })

      if (!newConnection) {
        throw new CredoError('No connection record to provision mediation.')
      }

      return this.connections.returnWhenIsConnected(newConnection.id)
    }

    if (!connection.isReady) {
      return this.connections.returnWhenIsConnected(connection.id)
    }
    return connection
  }
}
