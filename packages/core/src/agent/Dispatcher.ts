import type { AgentMessage } from './AgentMessage'
import type { AgentMessageProcessedEvent } from './Events'
import type { InboundMessageContext } from './models/InboundMessageContext'

import { InjectionSymbols } from '../constants'
import { CredoError } from '../error/CredoError'
import { Logger } from '../logger'
import { injectable, inject } from '../plugins'
import { parseMessageType } from '../utils/messageType'

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

  public async dispatch(messageContext: InboundMessageContext): Promise<void> {
    const { agentContext, connection, senderKey, recipientKey, message } = messageContext
    const messageHandler = this.messageHandlerRegistry.getHandlerForMessageType(message.type)

    if (!messageHandler) {
      throw new CredoError(`No handler for message type "${message.type}" found`)
    }

    let outboundMessage: OutboundMessageContext<AgentMessage> | void

    try {
      outboundMessage = await messageHandler.handle(messageContext)
    } catch (error) {
      const problemReportMessage = error.problemReport

      if (problemReportMessage instanceof ProblemReportMessage && messageContext.connection) {
        const { protocolUri: problemReportProtocolUri } = parseMessageType(problemReportMessage.type)
        const { protocolUri: inboundProtocolUri } = parseMessageType(messageContext.message.type)

        // If the inbound protocol uri is the same as the problem report protocol uri, we can see the interaction as the same thread
        // However if it is no the same we should see it as a new thread, where the inbound message `@id` is the parentThreadId
        if (inboundProtocolUri === problemReportProtocolUri) {
          problemReportMessage.setThread({
            threadId: message.threadId,
          })
        } else {
          problemReportMessage.setThread({
            parentThreadId: message.id,
          })
        }

        outboundMessage = new OutboundMessageContext(problemReportMessage, {
          agentContext,
          connection: messageContext.connection,
          inboundMessageContext: messageContext,
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
      // set the inbound message context, if not already defined
      if (!outboundMessage.inboundMessageContext) {
        outboundMessage.inboundMessageContext = messageContext
      }

      await this.messageSender.sendMessage(outboundMessage)
    }
    // Emit event that allows to hook into received messages
    this.eventEmitter.emit<AgentMessageProcessedEvent>(agentContext, {
      type: AgentEventTypes.AgentMessageProcessed,
      payload: {
        message,
        connection,
        receivedAt: messageContext.receivedAt,
      },
    })
  }
}

export { Dispatcher }
