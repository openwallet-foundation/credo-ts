import type { DidCommMessageProcessedEvent } from './DidCommEvents'
import type { DidCommMessage } from './DidCommMessage'
import type { DidCommMessageHandlerMiddleware } from './handlers/DidCommMessageHandlerMiddleware'
import type { DidCommInboundMessageContext } from './models/DidCommInboundMessageContext'

import { CredoError, EventEmitter, InjectionSymbols, Logger, inject, injectable } from '@credo-ts/core'

import { DidCommEventTypes } from './DidCommEvents'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommMessageSender } from './DidCommMessageSender'
import { DidCommProblemReportError } from './errors/problem-reports'
import { DidCommMessageHandlerMiddlewareRunner } from './handlers'
import { DidCommProblemReportMessage } from './messages'
import { DidCommOutboundMessageContext } from './models'
import { DidCommProblemReportReason } from './models/problem-reports'
import { canHandleMessageType, parseMessageType } from './util/messageType'

@injectable()
export class DidCommDispatcher {
  private messageHandlerRegistry: DidCommMessageHandlerRegistry
  private messageSender: DidCommMessageSender
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    messageSender: DidCommMessageSender,
    eventEmitter: EventEmitter,
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.messageHandlerRegistry = messageHandlerRegistry
    this.logger = logger
  }

  private defaultHandlerMiddleware: DidCommMessageHandlerMiddleware = async (inboundMessageContext, next) => {
    let messageHandler = inboundMessageContext.messageHandler

    const fallbackMessageHandler =
      inboundMessageContext.agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry).fallbackMessageHandler
    if (!messageHandler && fallbackMessageHandler) {
      messageHandler = {
        supportedMessages: [],
        handle: fallbackMessageHandler,
      }
    }

    if (!messageHandler) {
      throw new DidCommProblemReportError(
        `Error handling message ${inboundMessageContext.message.id} with type ${inboundMessageContext.message.type}. The message type is not supported`,
        {
          problemCode: DidCommProblemReportReason.MessageParseFailure,
        }
      )
    }

    const outboundMessage = await messageHandler.handle(inboundMessageContext)
    if (outboundMessage) {
      inboundMessageContext.setResponseMessage(outboundMessage)
    }

    await next()
  }

  public async dispatch(messageContext: DidCommInboundMessageContext): Promise<void> {
    const { agentContext, connection, senderKey, recipientKey, message, encryptedMessage } = messageContext

    // Set default handler if available, middleware can still override the message handler
    const messageHandler = this.messageHandlerRegistry.getHandlerForMessageType(message.type)
    if (messageHandler) {
      messageContext.setMessageHandler(messageHandler)
    }

    let outboundMessage: DidCommOutboundMessageContext<DidCommMessage> | undefined

    try {
      const messageHandlerMiddlewares =
        agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry).messageHandlerMiddlewares
      const middlewares = [...messageHandlerMiddlewares, this.defaultHandlerMiddleware]
      await DidCommMessageHandlerMiddlewareRunner.run(middlewares, messageContext)

      outboundMessage = messageContext.responseMessage
    } catch (error) {
      const problemReportMessage = error.problemReport

      if (problemReportMessage instanceof DidCommProblemReportMessage && messageContext.connection) {
        const messageType = parseMessageType(messageContext.message.type)
        if (canHandleMessageType(DidCommProblemReportMessage, messageType)) {
          throw new CredoError(`Not sending problem report in response to problem report: ${message}`)
        }

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

        outboundMessage = new DidCommOutboundMessageContext(problemReportMessage, {
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
    this.eventEmitter.emit<DidCommMessageProcessedEvent>(agentContext, {
      type: DidCommEventTypes.DidCommMessageProcessed,
      payload: {
        message,
        connection,
        receivedAt: messageContext.receivedAt,
        encryptedMessage,
      },
    })
  }
}
