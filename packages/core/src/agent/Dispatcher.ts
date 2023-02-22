import type { AgentMessage } from './AgentMessage'
import type { AgentMessageProcessedEvent } from './Events'
import type { MessageHandler } from './MessageHandler'
import type { InboundMessageContext } from './models/InboundMessageContext'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error/AriesFrameworkError'
import { Logger } from '../logger'
import { injectable, inject } from '../plugins'

import { ProblemReportMessage } from './../modules/problem-reports/messages/ProblemReportMessage'
import { EventEmitter } from './EventEmitter'
import { AgentEventTypes } from './Events'
import { MessageHandlerRegistry } from './MessageHandlerRegistry'
import { MessageSender } from './MessageSender'
import { OutboundMessageContext } from './models'

@injectable()
class Dispatcher {
  private messageHandlerRegistry: MessageHandlerRegistry
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    messageHandlerRegistry: MessageHandlerRegistry,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.messageHandlerRegistry = messageHandlerRegistry
    this.logger = logger
  }

  /**
   * @deprecated Use {@link MessageHandlerRegistry.registerMessageHandler} directly
   */
  public registerMessageHandler(messageHandler: MessageHandler) {
    this.messageHandlerRegistry.registerMessageHandler(messageHandler)
  }

  public async dispatch(messageContext: InboundMessageContext): Promise<void> {
    const { agentContext, connection, senderKey, recipientKey, message } = messageContext
    const messageHandler = this.messageHandlerRegistry.getHandlerForMessageType(message.type)

    if (!messageHandler) {
      throw new AriesFrameworkError(`No handler for message type "${message.type}" found`)
    }

    let outboundMessage: OutboundMessageContext<AgentMessage> | void

    try {
      outboundMessage = await messageHandler.handle(messageContext)
    } catch (error) {
      const problemReportMessage = error.problemReport
      if (problemReportMessage instanceof ProblemReportMessage && messageContext.connection) {
        problemReportMessage.setThread({
          threadId: message.threadId,
        })
        outboundMessage = new OutboundMessageContext(problemReportMessage, {
          agentContext,
          connection: messageContext.connection,
        })
      } else {
        this.logger.error(`Error handling message with type ${message.type}`, {
          message: message.toJSON(),
          error,
          senderKey: senderKey?.fingerprint,
          recipientKey: recipientKey?.fingerprint,
          connectionId: connection?.id,
        })

        throw error
      }
    }

    if (outboundMessage) {
      // Store the sessionId of the inbound message, if there is one, so messages can later be send without
      // outbound transport.
      outboundMessage.sessionIdFromInbound = messageContext.sessionId
      if (outboundMessage.isOutboundServiceMessage()) {
        await this.messageSender.sendMessageToService(outboundMessage)
      } else {
        outboundMessage.sessionId = messageContext.sessionId
        await this.messageSender.sendMessage(outboundMessage)
      }
    }
    // Emit event that allows to hook into received messages
    this.eventEmitter.emit<AgentMessageProcessedEvent>(agentContext, {
      type: AgentEventTypes.AgentMessageProcessed,
      payload: {
        message,
        connection,
      },
    })
  }
}

export { Dispatcher }
