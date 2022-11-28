import type { AgentMessage } from './AgentMessage'
import type { AgentMessageProcessedEvent } from './Events'
import type { Handler } from './Handler'
import type { InboundMessageContext } from './models/InboundMessageContext'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error/AriesFrameworkError'
import { Logger } from '../logger'
import { injectable, inject } from '../plugins'
import { canHandleMessageType, parseMessageType } from '../utils/messageType'

import { ProblemReportMessage } from './../modules/problem-reports/messages/ProblemReportMessage'
import { EventEmitter } from './EventEmitter'
import { AgentEventTypes } from './Events'
import { MessageSender } from './MessageSender'
import { OutboundMessageContext } from './models'

@injectable()
class Dispatcher {
  private handlers: Handler[] = []
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.logger = logger
  }

  public registerHandler(handler: Handler) {
    this.handlers.push(handler)
  }

  public async dispatch(messageContext: InboundMessageContext): Promise<void> {
    const { agentContext, connection, senderKey, recipientKey, message } = messageContext
    const handler = this.getHandlerForType(message.type)

    if (!handler) {
      throw new AriesFrameworkError(`No handler for message type "${message.type}" found`)
    }

    let outboundMessage: OutboundMessageContext<AgentMessage> | void

    try {
      outboundMessage = await handler.handle(messageContext)
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

  private getHandlerForType(messageType: string): Handler | undefined {
    const incomingMessageType = parseMessageType(messageType)

    for (const handler of this.handlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (canHandleMessageType(MessageClass, incomingMessageType)) return handler
      }
    }
  }

  public getMessageClassForType(messageType: string): typeof AgentMessage | undefined {
    const incomingMessageType = parseMessageType(messageType)

    for (const handler of this.handlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (canHandleMessageType(MessageClass, incomingMessageType)) return MessageClass
      }
    }
  }

  /**
   * Returns array of message types that dispatcher is able to handle.
   * Message type format is MTURI specified at https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0003-protocols/README.md#mturi.
   */
  public get supportedMessageTypes() {
    return this.handlers
      .reduce<typeof AgentMessage[]>((all, cur) => [...all, ...cur.supportedMessages], [])
      .map((m) => m.type)
  }

  /**
   * Returns array of protocol IDs that dispatcher is able to handle.
   * Protocol ID format is PIURI specified at https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0003-protocols/README.md#piuri.
   */
  public get supportedProtocols() {
    return Array.from(new Set(this.supportedMessageTypes.map((m) => m.protocolUri)))
  }

  public filterSupportedProtocolsByMessageFamilies(messageFamilies: string[]) {
    return this.supportedProtocols.filter((protocolId) =>
      messageFamilies.find((messageFamily) => protocolId.startsWith(messageFamily))
    )
  }
}

export { Dispatcher }
