import { CredoError, EventEmitter, InjectionSymbols, inject, injectable, type Logger } from '@credo-ts/core'
import type { DidCommAckReceivedEvent, DidCommMessageProcessedEvent } from './DidCommEvents'
import { DidCommEventTypes } from './DidCommEvents'
import type { DidCommMessage } from './DidCommMessage'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommMessageSender } from './DidCommMessageSender'
import { DidCommProblemReportError } from './errors/problem-reports'
import { DidCommMessageHandlerMiddlewareRunner } from './handlers'
import type { DidCommMessageHandlerMiddleware } from './handlers/DidCommMessageHandlerMiddleware'
import { DidCommProblemReportMessage, DidCommProblemReportV2Message } from './messages'
import { DidCommOutboundMessageContext } from './models'
import type { DidCommInboundMessageContext } from './models/DidCommInboundMessageContext'
import { DidCommProblemReportReason } from './models/problem-reports'
import { canHandleMessageType, type ParsedMessageType, parseMessageType } from './util/messageType'

// Answering a problem report with another one can loop forever: https://identity.foundation/didcomm-messaging/spec/v2.1/#cascading-problems
export function isProblemReportMessageType(messageType: ParsedMessageType): boolean {
  return (
    canHandleMessageType(DidCommProblemReportMessage, messageType) ||
    canHandleMessageType(DidCommProblemReportV2Message, messageType)
  )
}

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

    // The ack header is independent of the message body, so it is surfaced before the handler runs
    if (Array.isArray(message.ack) && message.ack.length > 0) {
      this.eventEmitter.emit<DidCommAckReceivedEvent>(agentContext, {
        type: DidCommEventTypes.DidCommAckReceived,
        payload: { message, acknowledgedMessageIds: message.ack, connection },
      })
    }

    let outboundMessage: DidCommOutboundMessageContext<DidCommMessage> | undefined
    let handled = false

    try {
      const messageHandlerMiddlewares =
        agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry).messageHandlerMiddlewares
      const middlewares = [
        ...messageHandlerMiddlewares,
        this.defaultHandlerMiddleware,
        async (): Promise<void> => {
          handled = true
        },
      ]
      await DidCommMessageHandlerMiddlewareRunner.run(middlewares, messageContext)

      outboundMessage = messageContext.responseMessage
    } catch (error) {
      const problemReportMessage = error.problemReport

      if (problemReportMessage instanceof DidCommProblemReportMessage && messageContext.connection) {
        const messageType = parseMessageType(messageContext.message.type)
        if (isProblemReportMessageType(messageType)) {
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

        const outboundProblemReport: DidCommMessage | undefined =
          messageContext.connection.didcommVersion === 'v2' &&
          problemReportMessage.type === DidCommProblemReportMessage.type.messageTypeUri
            ? DidCommProblemReportV2Message.fromProblemReportMessage(problemReportMessage, message)
            : problemReportMessage

        if (outboundProblemReport) {
          outboundMessage = new DidCommOutboundMessageContext(outboundProblemReport, {
            agentContext,
            connection: messageContext.connection,
            inboundMessageContext: messageContext,
          })
        } else {
          this.logger.warn(`Not sending a problem report for message ${message.id}, its id is not a valid pthid`, {
            error,
          })
        }
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
        handled,
      },
    })
  }
}
