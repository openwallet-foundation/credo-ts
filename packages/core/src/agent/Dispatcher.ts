import type { ConstructableDidCommMessage } from '../didcomm'
import type { ParsedMessageType } from '../utils/messageType'
import type { AgentMessage } from './AgentMessage'
import type { AgentMessageProcessedEvent } from './Events'
import type { MessageHandler } from './MessageHandler'
import type { InboundMessageContext } from './models/InboundMessageContext'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error/AriesFrameworkError'
import { Logger } from '../logger'
import { ProblemReportMessage } from '../modules/problem-reports/versions/v1/messages/ProblemReportMessage'
import { inject, injectable } from '../plugins'
import { canHandleMessageType, parseMessageType } from '../utils/messageType'

import { EventEmitter } from './EventEmitter'
import { AgentEventTypes } from './Events'
import { MessageSender } from './MessageSender'
import { OutboundMessageContext } from './models'

@injectable()
class Dispatcher {
  private messageHandlers: MessageHandler[] = []
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

  public registerMessageHandler(handler: MessageHandler) {
    this.messageHandlers.push(handler)
  }

  public async dispatch(messageContext: InboundMessageContext): Promise<void> {
    const { agentContext, connection, senderKey, recipientKey, message } = messageContext
    const messageHandler = this.getMessageHandlerForType(message.type)

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

  private getMessageHandlerForType(messageType: string): MessageHandler | undefined {
    const incomingMessageType = parseMessageType(messageType)

    for (const messageHandler of this.messageHandlers) {
      for (const MessageClass of messageHandler.supportedMessages) {
        if (canHandleMessageType(MessageClass, incomingMessageType)) return messageHandler
      }
    }
  }

  public getMessageClassForType(messageType: string): ConstructableDidCommMessage | undefined {
    const incomingMessageType = parseMessageType(messageType)

    for (const messageHandler of this.messageHandlers) {
      for (const MessageClass of messageHandler.supportedMessages) {
        if (canHandleMessageType(MessageClass, incomingMessageType)) return MessageClass
      }
    }
  }

  /**
   * Returns array of message types that dispatcher is able to handle.
   * Message type format is MTURI specified at https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0003-protocols/README.md#mturi.
   */
  public get supportedMessageTypes(): ParsedMessageType[] {
    return this.messageHandlers.reduce<ParsedMessageType[]>(
      (all, cur) => [...all, ...cur.supportedMessages.map((message) => message.type)],
      []
    )
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
