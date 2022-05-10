import type { BaseMessage } from '../../agent/BaseMessage'
import type { AgentMessageProcessedEvent } from '../../agent/Events'

import { firstValueFrom, of, ReplaySubject } from 'rxjs'
import { filter, takeUntil, timeout, catchError, map } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { AgentEventTypes } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { parseMessageType } from '../../utils/messageType'
import { ConnectionService } from '../connections/services'

import { DiscloseMessageHandler, QueryMessageHandler } from './handlers'
import { DiscloseMessage } from './messages'
import { DiscoverFeaturesService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class DiscoverFeaturesModule {
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private discoverFeaturesService: DiscoverFeaturesService
  private eventEmitter: EventEmitter
  private agentConfig: AgentConfig

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    discoverFeaturesService: DiscoverFeaturesService,
    eventEmitter: EventEmitter,
    agentConfig: AgentConfig
  ) {
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.discoverFeaturesService = discoverFeaturesService
    this.registerHandlers(dispatcher)
    this.eventEmitter = eventEmitter
    this.agentConfig = agentConfig
  }

  public async isProtocolSupported(connectionId: string, message: BaseMessage) {
    const { protocolUri } = parseMessageType(message.type)

    // Listen for response to our feature query
    const replaySubject = new ReplaySubject(1)
    this.eventEmitter
      .observable<AgentMessageProcessedEvent>(AgentEventTypes.AgentMessageProcessed)
      .pipe(
        // Stop when the agent shuts down
        takeUntil(this.agentConfig.stop$),
        // filter by connection id and query disclose message type
        filter((e) => e.payload.connection?.id === connectionId && e.payload.message.type === DiscloseMessage.type),
        // Return whether the protocol is supported
        map((e) => {
          const message = e.payload.message as DiscloseMessage
          return message.protocols.map((p) => p.protocolId).includes(protocolUri)
        }),
        // TODO: make configurable
        // If we don't have an answer in 7 seconds (no response, not supported, etc...) error
        timeout(7000),
        // We want to return false if an error occurred
        catchError(() => of(false))
      )
      .subscribe(replaySubject)

    await this.queryFeatures(connectionId, {
      query: protocolUri,
      comment: 'Detect if protocol is supported',
    })

    const isProtocolSupported = await firstValueFrom(replaySubject)
    return isProtocolSupported
  }

  public async queryFeatures(connectionId: string, options: { query: string; comment?: string }) {
    const connection = await this.connectionService.getById(connectionId)

    const queryMessage = await this.discoverFeaturesService.createQuery(options)

    const outbound = createOutboundMessage(connection, queryMessage)
    await this.messageSender.sendMessage(outbound)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new DiscloseMessageHandler())
    dispatcher.registerHandler(new QueryMessageHandler(this.discoverFeaturesService))
  }
}
